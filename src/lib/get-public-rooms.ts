import { createServerClient } from "@/lib/supabase/server";

export interface PublicRoomItem {
  code: string;
  name: string;
  roomType: "PUBLIC" | "LOCKED";
  playerCount: number;
  maxPlayers: number;
  status: "WAITING" | "PLAYING" | "FULL";
}

export async function getPublicRooms(): Promise<PublicRoomItem[]> {
  const db = createServerClient();
  const { data, error } = await db
    .from("rooms")
    .select("code, name, room_type, max_players, phase")
    .in("room_type", ["PUBLIC", "LOCKED"])
    .eq("phase", "WAITING")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);

  const rooms = await Promise.all(
    (data ?? []).map(async (r) => {
      const { count } = await db
        .from("players")
        .select("*", { count: "exact", head: true })
        .eq("room_id", r.code);
      return {
        code: r.code,
        name: r.name,
        roomType: r.room_type as "PUBLIC" | "LOCKED",
        playerCount: count ?? 0,
        maxPlayers: r.max_players,
        status:
          r.phase === "WAITING"
            ? ("WAITING" as const)
            : count === r.max_players
            ? ("FULL" as const)
            : ("PLAYING" as const),
      };
    })
  );

  return rooms;
}
