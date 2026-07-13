import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { err, ok, getSessionId } from "@/lib/api-helpers";
import { broadcast, roomChannel } from "@/lib/broadcast";
import { randomUUID } from "crypto";

interface RoomRow { id: string; host_id: string | null; phase: string; max_players: number; lives: number; game_mode: string | null; }
interface PlayerRow { id: string; session_id: string; nickname: string; lives: number; alive: boolean; connected: boolean; team?: string | null; }

const BOT_NAMES = ["봇A", "봇B", "봇C", "봇D", "봇E"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const upperCode = code.toUpperCase();
  const sessionId = getSessionId(req);
  if (!sessionId) return err("MISSING_SESSION", "x-session-id required");

  const db = createServerClient();
  const { data: room } = await db
    .from("rooms")
    .select("id,host_id,phase,max_players,lives,game_mode")
    .eq("code", upperCode)
    .single() as { data: RoomRow | null };

  if (!room) return err("ROOM_NOT_FOUND", "존재하지 않는 방입니다", 404);
  if (room.phase !== "WAITING") return err("NOT_WAITING", "대기 중에만 봇을 추가할 수 있습니다");

  const { data: me } = await db
    .from("players").select("id")
    .eq("room_id", room.id).eq("session_id", sessionId)
    .maybeSingle() as { data: { id: string } | null };

  if (!me) return err("NOT_IN_ROOM", "방에 입장하지 않았습니다", 403);
  if (room.host_id !== me.id) return err("NOT_HOST", "방장만 봇을 추가할 수 있습니다", 403);

  const { count } = await db
    .from("players").select("*", { count: "exact", head: true })
    .eq("room_id", room.id);

  if ((count ?? 0) >= room.max_players) return err("ROOM_FULL", "방이 꽉 찼습니다", 409);

  const { data: existingPlayers } = await db
    .from("players").select("nickname")
    .eq("room_id", room.id) as { data: Array<{ nickname: string }> | null };

  const usedNames = new Set((existingPlayers ?? []).map((p) => p.nickname));
  const botName = BOT_NAMES.find((n) => !usedNames.has(n));
  if (!botName) return err("MAX_BOTS", "더 이상 봇을 추가할 수 없습니다", 409);

  const { data: bot } = await db
    .from("players")
    .insert({
      room_id: room.id,
      session_id: `bot:${randomUUID()}`,
      nickname: botName,
      lives: room.lives,
      alive: true,
      connected: true,
    })
    .select("id").single() as { data: { id: string } | null };

  if (!bot) return err("DB_ERROR", "봇 추가에 실패했습니다", 500);

  if (room.game_mode === "TEAM") {
    const { data: teams } = await db
      .from("players").select("team")
      .eq("room_id", room.id).eq("alive", true) as { data: Array<{ team: string | null }> | null };
    const aCount = (teams ?? []).filter((p) => p.team === "A").length;
    const bCount = (teams ?? []).filter((p) => p.team === "B").length;
    await db.from("players").update({ team: aCount <= bCount ? "A" : "B" }).eq("id", bot.id);
  }

  const { data: allPlayers } = await db
    .from("players").select("id,session_id,nickname,lives,alive,connected,team")
    .eq("room_id", room.id) as { data: PlayerRow[] | null };

  await broadcast(roomChannel(upperCode), "PLAYER_UPDATE", {
    players: (allPlayers ?? []).map((p) => ({ ...p, isHost: p.id === room.host_id })),
  });

  return ok({ botId: bot.id, nickname: botName });
}
