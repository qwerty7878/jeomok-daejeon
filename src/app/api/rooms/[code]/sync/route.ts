import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { err, ok, getSessionId } from "@/lib/api-helpers";
import { broadcast, roomChannel } from "@/lib/broadcast";

interface RoomRow { id: string; host_id: string | null; }
interface PlayerRow { id: string; nickname: string; lives: number; alive: boolean; connected: boolean; }

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const upperCode = code.toUpperCase();
  const sessionId = getSessionId(req);
  if (!sessionId) return err("MISSING_SESSION", "x-session-id required");

  const body = await req.json().catch(() => ({})) as { leftSessionId?: string };

  const db = createServerClient();
  const { data: room } = await db
    .from("rooms").select("id,host_id")
    .eq("code", upperCode).single() as { data: RoomRow | null };

  if (!room) return ok({ synced: true });

  if (body.leftSessionId) {
    const { data: left } = await db
      .from("players").select("id")
      .eq("room_id", room.id).eq("session_id", body.leftSessionId)
      .single() as { data: { id: string } | null };

    if (left) {
      await db.from("players").update({ connected: false }).eq("id", left.id);

      if (left.id === room.host_id) {
        const { data: others } = await db
          .from("players").select("id")
          .eq("room_id", room.id).eq("connected", true)
          .neq("id", left.id).order("joined_at").limit(1) as { data: Array<{ id: string }> | null };

        const newHost = others?.[0];
        if (newHost) {
          await db.from("rooms").update({ host_id: newHost.id }).eq("id", room.id);
          await broadcast(roomChannel(upperCode), "HOST_CHANGED", { newHostId: newHost.id });
        }
      }
    }
  }

  const { data: allPlayers } = await db
    .from("players").select("id,nickname,lives,alive,connected")
    .eq("room_id", room.id) as { data: PlayerRow[] | null };

  await broadcast(roomChannel(upperCode), "PLAYER_UPDATE", { players: allPlayers });
  return ok({ synced: true });
}
