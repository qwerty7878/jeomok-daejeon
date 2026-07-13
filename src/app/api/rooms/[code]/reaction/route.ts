import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { err, ok, getSessionId } from "@/lib/api-helpers";
import { broadcast, roomChannel } from "@/lib/broadcast";

const ALLOWED_EMOJIS = new Set(["🤣", "👍", "💀", "😭", "🔥", "😮", "🥶"]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const upperCode = code.toUpperCase();
  const sessionId = getSessionId(req);
  if (!sessionId) return err("MISSING_SESSION", "x-session-id required");

  const body = await req.json();
  const { emoji } = body as { emoji: string };
  if (!emoji || !ALLOWED_EMOJIS.has(emoji)) return err("INVALID_EMOJI", "허용되지 않는 이모지입니다");

  const db = createServerClient();
  const { data: room } = await db
    .from("rooms").select("id")
    .eq("code", upperCode).single() as { data: { id: string } | null };
  if (!room) return err("ROOM_NOT_FOUND", "존재하지 않는 방입니다", 404);

  const { data: player } = await db
    .from("players").select("nickname")
    .eq("room_id", room.id).eq("session_id", sessionId)
    .maybeSingle() as { data: { nickname: string } | null };
  if (!player) return err("NOT_IN_ROOM", "방에 입장하지 않았습니다", 403);

  await broadcast(roomChannel(upperCode), "REACTION", { nickname: player.nickname, emoji });

  return ok({ ok: true });
}
