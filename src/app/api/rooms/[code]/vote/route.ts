import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { err, ok, getSessionId } from "@/lib/api-helpers";
import { broadcast, roomChannel } from "@/lib/broadcast";
import { computeAndBroadcastResult } from "@/lib/game/transitions";

interface RoomRow { id: string; phase: string; round: number; deadline: string | null; }
interface PlayerRow { id: string; }
interface AllPlayerRow { id: string; session_id: string; alive: boolean; }
interface SubmissionRow { id: string; player_id: string; }

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const upperCode = code.toUpperCase();
  const sessionId = getSessionId(req);
  if (!sessionId) return err("MISSING_SESSION", "x-session-id required");

  const body = await req.json();
  const { round, submissionId } = body as { round: number; submissionId: string };

  const db = createServerClient();
  const { data: room } = await db
    .from("rooms").select("id,phase,round,deadline")
    .eq("code", upperCode).single() as { data: RoomRow | null };

  if (!room) return err("ROOM_NOT_FOUND", "존재하지 않는 방입니다", 404);
  if (room.phase !== "VOTING") return err("PHASE_MISMATCH", "투표 단계가 아닙니다");
  if (room.round !== Number(round)) return err("PHASE_MISMATCH", "라운드가 일치하지 않습니다");

  // 독립적인 조회 3개를 병렬로 — voter 존재 확인, 제출물 확인, 전체 플레이어(1v1 판정/인간·봇 구분용) 한 번에
  const [voterRes, subRes, allPlayersRes] = await Promise.all([
    db.from("players").select("id").eq("room_id", room.id).eq("session_id", sessionId).single() as unknown as Promise<{ data: PlayerRow | null }>,
    db.from("submissions").select("player_id").eq("id", submissionId).eq("room_id", room.id).single() as unknown as Promise<{ data: SubmissionRow | null }>,
    db.from("players").select("id,session_id,alive").eq("room_id", room.id) as unknown as Promise<{ data: AllPlayerRow[] | null }>,
  ]);

  const voter = voterRes.data;
  const sub = subRes.data;
  const allPlayers = allPlayersRes.data ?? [];

  if (!voter) return err("NOT_IN_ROOM", "이 방의 플레이어가 아닙니다", 403);
  if (!sub) return err("NOT_FOUND", "존재하지 않는 제출입니다", 404);

  const alivePlayers = allPlayers.filter((p) => p.alive);
  const aliveCount = alivePlayers.length;

  // 1v1일 때는 자기 제목에도 투표 허용 (안 그러면 항상 동점 교착 상태)
  const is1v1 = aliveCount <= 2;
  if (!is1v1 && sub.player_id === voter.id) return err("CANNOT_VOTE_SELF", "자기 제목에는 투표할 수 없습니다");

  await db.from("votes").upsert(
    { room_id: room.id, round: room.round, voter_id: voter.id, submission_id: submissionId },
    { onConflict: "room_id,round,voter_id" }
  );

  const { data: allVotes } = await db
    .from("votes").select("voter_id")
    .eq("room_id", room.id).eq("round", room.round) as { data: Array<{ voter_id: string }> | null };

  const voterIds = (allVotes ?? []).map((v) => v.voter_id);
  const totalVoters = allPlayers.length;

  // 인간 플레이어만 집계 (봇 제외)
  const humanPlayers = alivePlayers.filter((p) => !p.session_id.startsWith("bot:"));
  const botPlayers = alivePlayers.filter((p) => p.session_id.startsWith("bot:"));
  const humanPlayerIds = new Set(humanPlayers.map((p) => p.id));
  const humanVoted = voterIds.filter((id) => humanPlayerIds.has(id)).length;
  const humanCount = humanPlayerIds.size;

  await broadcast(roomChannel(upperCode), "VOTE_PROGRESS", {
    voted: voterIds.length, total: totalVoters, voterIds,
  });

  // 인간 전원 투표 → 봇 자동 투표와 phase 전이를 동시에 진행
  if (humanCount > 0 && humanVoted >= humanCount) {
    const deadline = new Date(Date.now() + 15000).toISOString();
    const existingVoterSet = new Set(voterIds);
    const pendingBots = botPlayers.filter((b) => !existingVoterSet.has(b.id));

    const [updateRes] = await Promise.all([
      db.from("rooms")
        .update({ phase: "ROUND_RESULT", deadline, updated_at: new Date().toISOString() })
        .eq("code", upperCode).eq("phase", "VOTING").eq("round", room.round)
        .select("id").maybeSingle() as unknown as Promise<{ data: { id: string } | null }>,
      (async () => {
        if (pendingBots.length === 0) return;
        const { data: allSubs } = await db
          .from("submissions").select("id,player_id")
          .eq("room_id", room.id).eq("round", room.round) as { data: SubmissionRow[] | null };
        if (!allSubs || allSubs.length === 0) return;

        // 봇마다 투표 대상을 병렬로 upsert (순차 왕복 제거)
        await Promise.all(pendingBots.map((bot) => {
          const eligible = allSubs.filter((s) => s.player_id !== bot.id);
          if (eligible.length === 0) return null;
          const pick = eligible[Math.floor(Math.random() * eligible.length)];
          return db.from("votes").upsert(
            { room_id: room.id, round: room.round, voter_id: bot.id, submission_id: pick.id },
            { onConflict: "room_id,round,voter_id" }
          );
        }));
      })(),
    ]);

    if (updateRes.data) {
      await broadcast(roomChannel(upperCode), "PHASE_CHANGED", { phase: "ROUND_RESULT", round: room.round, deadline });
      await computeAndBroadcastResult(upperCode, room.round);
    }
  }

  return ok({ voted: true });
}
