import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { err, ok, getSessionId } from "@/lib/api-helpers";
import { broadcast, roomChannel } from "@/lib/broadcast";

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
    .from("rooms").select("id,phase")
    .eq("code", upperCode).single() as { data: { id: string; phase: string } | null };

  if (!room) return err("ROOM_NOT_FOUND", "존재하지 않는 방입니다", 404);
  if (room.phase !== "ROUND_RESULT") return err("PHASE_MISMATCH", "결과 페이지가 아닙니다");

  const { data: player } = await db
    .from("players").select("id")
    .eq("room_id", room.id).eq("session_id", sessionId)
    .maybeSingle() as { data: { id: string } | null };

  if (!player) return err("NOT_IN_ROOM", "방에 입장하지 않았습니다", 403);

  await broadcast(roomChannel(upperCode), "SKIP_READY", { playerId: player.id });

  return ok({ ok: true });
}
