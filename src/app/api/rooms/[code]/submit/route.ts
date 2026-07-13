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

  const { data: allSubs } = await db
    .from("submissions").select("player_id")
    .eq("room_id", room.id).eq("round", room.round) as { data: Array<{ player_id: string }> | null };

  const playerIds = (allSubs ?? []).map((s) => s.player_id);
  const submitted = playerIds.length;

  const { count: aliveCount } = await db
    .from("players").select("*", { count: "exact", head: true })
    .eq("room_id", room.id).eq("alive", true);

  // 인간 플레이어 수 (봇 제외) — 즉시 전환 기준
  const { data: humanPlayers } = await db
    .from("players").select("id")
    .eq("room_id", room.id).eq("alive", true)
    .not("session_id", "like", "bot:%") as { data: Array<{ id: string }> | null };
  const humanCount = humanPlayers?.length ?? 0;

  // 제출한 인간 플레이어 수
  const { data: humanSubs } = await db
    .from("submissions")
    .select("player_id")
    .eq("room_id", room.id)
    .eq("round", room.round)
    .in("player_id", (humanPlayers ?? []).map((p) => p.id)) as { data: Array<{ player_id: string }> | null };
  const humanSubmitted = humanSubs?.length ?? 0;

  await broadcast(roomChannel(upperCode), "SUBMIT_PROGRESS", {
    submitted, total: aliveCount ?? 0, playerIds,
  });

  // 인간 전원 제출 → 봇 자동 제출 후 즉시 VOTING 전이
  if (humanCount > 0 && humanSubmitted >= humanCount) {
    // 봇 자동 제출
    const { data: botPlayers } = await db
      .from("players").select("id")
      .eq("room_id", room.id).eq("alive", true)
      .like("session_id", "bot:%") as { data: Array<{ id: string }> | null };

    if (botPlayers && botPlayers.length > 0) {
      const existing = new Set(playerIds);
      const pending = botPlayers.filter((b) => !existing.has(b.id));
      if (pending.length > 0) {
        // AI로 이미지 보고 제목 생성
        const imageUrl = await getRoomImageUrl(room.id, room.current_image);
        const titles = await Promise.all(pending.map(() => generateBotTitle(imageUrl)));
        await db.from("submissions").insert(
          pending.map((b, i) => ({
            room_id: room.id, round: room.round, player_id: b.id, title: titles[i],
          }))
        );
      }
    }

    const deadline = new Date(Date.now() + 30000).toISOString();
    const { data: updated } = await db
      .from("rooms")
      .update({ phase: "VOTING", deadline, updated_at: new Date().toISOString() })
      .eq("code", upperCode).eq("phase", "WRITING").eq("round", room.round)
      .select("id").maybeSingle() as { data: { id: string } | null };

    if (updated) {
      const { data: subs } = await db
        .from("submissions").select("id,title")
        .eq("room_id", room.id).eq("round", room.round) as { data: Array<{ id: string; title: string }> | null };

      await broadcast(roomChannel(upperCode), "PHASE_CHANGED", { phase: "VOTING", round: room.round, deadline });
      await broadcast(roomChannel(upperCode), "SUBMISSIONS_REVEALED", { submissions: shuffle(subs ?? []) });
    }
  }

  return ok({ submitted: true, submissionId: upserted?.id ?? null });
}
