import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { err, ok, getSessionId } from "@/lib/api-helpers";
import { broadcast, roomChannel } from "@/lib/broadcast";
import { shuffle } from "@/lib/game/transitions";
import { generateBotTitle, getRoomImageUrl } from "@/lib/game/botTitles";

interface RoomRow {
  id: string; phase: string; round: number;
  deadline: string | null; current_image: string | null;
}
interface PlayerRow { id: string; alive: boolean; }
interface AlivePlayerRow { id: string; session_id: string; }
interface SubRow { id: string; title: string; player_id: string; }

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const upperCode = code.toUpperCase();
  const sessionId = getSessionId(req);
  if (!sessionId) return err("MISSING_SESSION", "x-session-id required");

  const body = await req.json();
  const { round, title } = body as { round: number; title: string };

  if (!title || title.trim().length === 0) return err("INVALID_TITLE", "제목을 입력해주세요");
  if (title.length > 40) return err("INVALID_TITLE", "제목은 40자 이하여야 합니다");

  const db = createServerClient();
  const { data: room } = await db
    .from("rooms").select("id,phase,round,deadline,current_image")
    .eq("code", upperCode).single() as { data: RoomRow | null };

  if (!room) return err("ROOM_NOT_FOUND", "존재하지 않는 방입니다", 404);
  if (room.phase !== "WRITING") return err("PHASE_MISMATCH", "제출 단계가 아닙니다");
  if (room.round !== Number(round)) return err("PHASE_MISMATCH", "라운드가 일치하지 않습니다");
  if (room.deadline && new Date(room.deadline) <= new Date()) return err("DEADLINE_PASSED", "마감 시간이 지났습니다");

  const { data: player } = await db
    .from("players").select("id,alive")
    .eq("room_id", room.id).eq("session_id", sessionId)
    .single() as { data: PlayerRow | null };

  if (!player) return err("NOT_IN_ROOM", "이 방의 플레이어가 아닙니다", 403);
  if (!player.alive) return err("SPECTATOR", "관전자는 제출할 수 없습니다", 403);

  const { data: upserted } = await db.from("submissions").upsert(
    { room_id: room.id, round: room.round, player_id: player.id, title: title.trim() },
    { onConflict: "room_id,round,player_id" }
  ).select("id").single() as { data: { id: string } | null };

  // 독립적인 조회 2개는 병렬로 — 리전 왕복이 라운드 전이 체감 지연의 핵심이라 여기서 아낀다
  const [allSubsRes, alivePlayersRes] = await Promise.all([
    db.from("submissions").select("id,title,player_id")
      .eq("room_id", room.id).eq("round", room.round) as unknown as Promise<{ data: SubRow[] | null }>,
    db.from("players").select("id,session_id")
      .eq("room_id", room.id).eq("alive", true) as unknown as Promise<{ data: AlivePlayerRow[] | null }>,
  ]);

  const allSubs = allSubsRes.data ?? [];
  const alivePlayers = alivePlayersRes.data ?? [];
  const playerIds = allSubs.map((s) => s.player_id);
  const submitted = playerIds.length;
  const aliveCount = alivePlayers.length;

  const humanPlayers = alivePlayers.filter((p) => !p.session_id.startsWith("bot:"));
  const botPlayers = alivePlayers.filter((p) => p.session_id.startsWith("bot:"));
  const humanCount = humanPlayers.length;
  const humanPlayerIds = new Set(humanPlayers.map((p) => p.id));
  const humanSubmitted = playerIds.filter((id) => humanPlayerIds.has(id)).length;

  await broadcast(roomChannel(upperCode), "SUBMIT_PROGRESS", {
    submitted, total: aliveCount, playerIds,
  });

  // 인간 전원 제출 → 봇 자동 제출과 phase 전이를 동시에 진행
  if (humanCount > 0 && humanSubmitted >= humanCount) {
    const existing = new Set(playerIds);
    const pendingBots = botPlayers.filter((b) => !existing.has(b.id));

    const deadline = new Date(Date.now() + 30000).toISOString();

    const [updateRes, botSubs] = await Promise.all([
      db.from("rooms")
        .update({ phase: "VOTING", deadline, updated_at: new Date().toISOString() })
        .eq("code", upperCode).eq("phase", "WRITING").eq("round", room.round)
        .select("id").maybeSingle() as unknown as Promise<{ data: { id: string } | null }>,
      (async (): Promise<SubRow[]> => {
        if (pendingBots.length === 0) return [];
        const imageUrl = await getRoomImageUrl(room.id, room.current_image);
        const titles = await Promise.all(pendingBots.map(() => generateBotTitle(imageUrl)));
        const { data: inserted } = await db.from("submissions").insert(
          pendingBots.map((b, i) => ({
            room_id: room.id, round: room.round, player_id: b.id, title: titles[i],
          }))
        ).select("id,title,player_id") as { data: SubRow[] | null };
        return inserted ?? [];
      })(),
    ]);

    if (updateRes.data) {
      const finalSubs = [...allSubs, ...botSubs];
      await broadcast(roomChannel(upperCode), "PHASE_CHANGED", { phase: "VOTING", round: room.round, deadline });
      await broadcast(roomChannel(upperCode), "SUBMISSIONS_REVEALED", {
        submissions: shuffle(finalSubs.map((s) => ({ id: s.id, title: s.title }))),
      });
    }
  }

  return ok({ submitted: true, submissionId: upserted?.id ?? null });
}
