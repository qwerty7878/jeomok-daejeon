import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { err, ok, getSessionId } from "@/lib/api-helpers";

interface RoomRow {
  id: string; code: string; name: string; room_type: string;
  phase: string; round: number; deadline: string | null;
  lives: number; write_sec: number; max_players: number;
  host_id: string | null; current_image: string | null;
  image_source: string; image_category: string; game_mode: string;
}
interface PlayerRow {
  id: string; session_id: string; nickname: string;
  lives: number; alive: boolean; connected: boolean; team: string | null;
}
interface SubmissionRow { id: string; title: string; player_id: string; }
interface PlayerNickRow { id: string; nickname: string; }
interface VoteRow { submission_id: string; }
interface ImageRow { url: string; }

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const sessionId = getSessionId(req);
  if (!sessionId) return err("MISSING_SESSION", "x-session-id required");

  const db = createServerClient();

  // 마이그레이션 후 새 컬럼 포함, 없으면 기본 컬럼만 조회
  let { data: room, error } = await db
    .from("rooms")
    .select("id,code,name,room_type,phase,round,deadline,lives,write_sec,max_players,host_id,current_image,image_source,image_category,game_mode")
    .eq("code", code.toUpperCase())
    .single() as { data: RoomRow | null; error: unknown };

  const isMissingCol = (e: unknown) => { const m = (e as { message?: string })?.message ?? ""; return m.includes("Could not find the") || m.includes("does not exist"); };
  if (isMissingCol(error)) {
    // 새 컬럼 없음 — 기존 컬럼만 조회
    const fallback = await db
      .from("rooms")
      .select("id,code,name,room_type,phase,round,deadline,lives,write_sec,max_players,host_id,current_image")
      .eq("code", code.toUpperCase())
      .single() as { data: Omit<RoomRow, "image_source" | "image_category" | "game_mode"> | null; error: unknown };
    room = fallback.data ? { ...fallback.data, image_source: "LIBRARY", image_category: "random", game_mode: "SOLO" } : null;
    error = fallback.error;
  }

  if (error || !room) return err("ROOM_NOT_FOUND", "존재하지 않는 방입니다", 404);

  let { data: players } = await db
    .from("players")
    .select("id,session_id,nickname,lives,alive,connected,team")
    .eq("room_id", room.id)
    .order("joined_at") as { data: PlayerRow[] | null };

  if (!players) {
    // team 컬럼 없는 경우 fallback
    const fallback = await db
      .from("players")
      .select("id,session_id,nickname,lives,alive,connected")
      .eq("room_id", room.id)
      .order("joined_at") as { data: Omit<PlayerRow, "team">[] | null };
    players = (fallback.data ?? []).map((p) => ({ ...p, team: null }));
  }

  const me = (players ?? []).find((p) => p.session_id === sessionId);
  if (!me) return err("NOT_IN_ROOM", "이 방의 플레이어가 아닙니다", 403);

  const { count: submittedCount } = me.alive
    ? await db
        .from("submissions")
        .select("*", { count: "exact", head: true })
        .eq("room_id", room.id)
        .eq("round", room.round)
        .eq("player_id", me.id)
    : { count: 0 };

  const { count: votedCount } = await db
    .from("votes")
    .select("*", { count: "exact", head: true })
    .eq("room_id", room.id)
    .eq("round", room.round)
    .eq("voter_id", me.id);

  // 이미지 URL 별도 조회
  let imageUrl: string | undefined;
  if (room.current_image) {
    const { data: img } = await db
      .from("images")
      .select("url")
      .eq("id", room.current_image)
      .single() as { data: ImageRow | null };
    imageUrl = img?.url;
  }

  const response: Record<string, unknown> = {
    room: {
      code: room.code,
      name: room.name,
      roomType: room.room_type,
      phase: room.phase,
      round: room.round,
      deadline: room.deadline,
      lives: room.lives,
      writeSec: room.write_sec,
      maxPlayers: room.max_players,
      hostId: room.host_id,
      imageSource: room.image_source,
      imageCategory: room.image_category,
      gameMode: room.game_mode,
    },
    players: (players ?? []).map((p) => ({
      id: p.id,
      nickname: p.nickname,
      lives: p.lives,
      alive: p.alive,
      connected: p.connected,
      isHost: p.id === room.host_id,
      team: p.team ?? null,
    })),
    me: {
      playerId: me.id,
      alive: me.alive,
      submitted: (submittedCount ?? 0) > 0,
      voted: (votedCount ?? 0) > 0,
    },
  };

  if (room.phase !== "WAITING" && imageUrl) {
    response.image = { url: imageUrl };
  }

  // WRITING 중에는 submissions 절대 포함 금지
  if (room.phase === "VOTING" || room.phase === "ROUND_RESULT" || room.phase === "GAME_OVER") {
    const { data: subs } = await db
      .from("submissions")
      .select("id,title")
      .eq("room_id", room.id)
      .eq("round", room.round) as { data: Array<{ id: string; title: string }> | null };
    response.submissions = subs ?? [];
  }

  if (room.phase === "ROUND_RESULT") {
    const { data: subs } = await db
      .from("submissions")
      .select("id,title,player_id")
      .eq("room_id", room.id)
      .eq("round", room.round) as { data: SubmissionRow[] | null };

    const { data: votes } = await db
      .from("votes")
      .select("submission_id")
      .eq("room_id", room.id)
      .eq("round", room.round) as { data: VoteRow[] | null };

    // 닉네임 별도 조회
    const playerIds = [...new Set((subs ?? []).map((s) => s.player_id))];
    const { data: nickPlayers } = playerIds.length > 0
      ? await db.from("players").select("id,nickname").in("id", playerIds) as { data: PlayerNickRow[] | null }
      : { data: [] as PlayerNickRow[] };

    const nickMap: Record<string, string> = {};
    for (const p of nickPlayers ?? []) nickMap[p.id] = p.nickname;

    const voteCounts: Record<string, number> = {};
    for (const v of votes ?? []) {
      voteCounts[v.submission_id] = (voteCounts[v.submission_id] ?? 0) + 1;
    }

    const ranking = (subs ?? [])
      .map((s) => ({ id: s.id, title: s.title, author: nickMap[s.player_id] ?? "?", votes: voteCounts[s.id] ?? 0 }))
      .sort((a, b) => b.votes - a.votes);

    const minVotes = ranking.length > 0 ? Math.min(...ranking.map((r) => r.votes)) : 0;
    const eliminated = ranking.filter((r) => r.votes === minVotes).map((r) => r.id);
    response.result = { ranking, eliminated };
  }

  return ok(response);
}
