import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { err, ok, getSessionId } from "@/lib/api-helpers";
import { broadcast, roomChannel } from "@/lib/broadcast";

interface RoomRow { id: string; phase: string; lives: number; }
interface PlayerRow { id: string; nickname: string; lives: number; alive: boolean; connected: boolean; team?: string | null; }

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
    .from("rooms").select("id,phase,lives")
    .eq("code", upperCode).single() as { data: RoomRow | null };

  if (!room) return err("ROOM_NOT_FOUND", "존재하지 않는 방입니다", 404);
  if (room.phase !== "GAME_OVER") return err("PHASE_MISMATCH", "게임이 끝나야 한 판 더를 할 수 있습니다");

  await db.from("players")
    .update({ lives: room.lives, alive: true })
    .eq("room_id", room.id);

  await db.from("rooms").update({
    phase: "WAITING", round: 0, deadline: null,
    current_image: null, used_images: [],
    updated_at: new Date().toISOString(),
  }).eq("code", upperCode);

  // 계측
  await db.from("game_results")
    .update({ rematched: true })
    .eq("room_code", upperCode)
    .order("played_at", { ascending: false })
    .limit(1);

  const { data: players } = await db
    .from("players").select("id,nickname,lives,alive,connected,team")
    .eq("room_id", room.id) as { data: PlayerRow[] | null };

  await broadcast(roomChannel(upperCode), "PHASE_CHANGED", { phase: "WAITING", round: 0, deadline: null });
  await broadcast(roomChannel(upperCode), "PLAYER_UPDATE", { players });

  return ok({ rematched: true });
}
