import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { err, ok, getSessionId } from "@/lib/api-helpers";
import { broadcast, roomChannel } from "@/lib/broadcast";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const upperCode = code.toUpperCase();
  const sessionId = getSessionId(req);
  if (!sessionId) return err("MISSING_SESSION", "x-session-id required");

  const body = await req.json();
  const { lives, maxPlayers, writeSec } = body as {
    lives?: number;
    maxPlayers?: number;
    writeSec?: number;
  };

  const db = createServerClient();

  const { data: room } = await db
    .from("rooms")
    .select("id,phase,host_id")
    .eq("code", upperCode)
    .single() as { data: { id: string; phase: string; host_id: string | null } | null };

  if (!room) return err("ROOM_NOT_FOUND", "존재하지 않는 방입니다", 404);
  if (room.phase !== "WAITING") return err("PHASE_MISMATCH", "대기 중에만 설정을 변경할 수 있습니다");

  const { data: me } = await db
    .from("players")
    .select("id")
    .eq("room_id", room.id)
    .eq("session_id", sessionId)
    .single() as { data: { id: string } | null };

  if (!me || me.id !== room.host_id) return err("NOT_HOST", "방장만 변경할 수 있습니다", 403);

  const updates: Record<string, number> = {};
  if (lives !== undefined) {
    const v = Math.min(5, Math.max(2, Number(lives)));
    updates.lives = v;
  }
  if (maxPlayers !== undefined) {
    const v = Math.min(12, Math.max(3, Number(maxPlayers)));
    updates.max_players = v;
  }
  if (writeSec !== undefined && [30, 45, 60].includes(Number(writeSec))) {
    updates.write_sec = Number(writeSec);
  }

  if (Object.keys(updates).length === 0) return err("NO_CHANGES", "변경할 항목이 없습니다");

  await db.from("rooms").update({ ...updates, updated_at: new Date().toISOString() }).eq("code", upperCode);

  await broadcast(roomChannel(upperCode), "SETTINGS_CHANGED", updates);

  return ok({ updated: true, ...updates });
}
