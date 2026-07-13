import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { err, ok, getSessionId } from "@/lib/api-helpers";
import { broadcast, roomChannel } from "@/lib/broadcast";
import { pickNextImage } from "@/lib/game/transitions";

interface RoomRow {
  id: string; phase: string; host_id: string | null;
  write_sec: number; round: number; used_images: string[];
  game_mode: string; image_category: string | null; image_source: string | null;
}
interface PlayerRow { id: string; }

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const sessionId = getSessionId(req);
  if (!sessionId) return err("MISSING_SESSION", "x-session-id required");

  const db = createServerClient();
  const isMissingCol = (e: unknown) => { const m = (e as { message?: string })?.message ?? ""; return m.includes("Could not find the") || m.includes("does not exist"); };

  const { data: initialRoom, error: roomErr } = await db
    .from("rooms")
    .select("id,phase,host_id,write_sec,round,used_images,game_mode,image_category,image_source")
    .eq("code", code.toUpperCase())
    .single() as { data: RoomRow | null; error: unknown };

  let room = initialRoom;
  if (isMissingCol(roomErr)) {
    const fb = await db
      .from("rooms")
      .select("id,phase,host_id,write_sec,round,used_images")
      .eq("code", code.toUpperCase())
      .single() as { data: Omit<RoomRow, "game_mode" | "image_category" | "image_source"> | null; error: unknown };
    room = fb.data ? { ...fb.data, game_mode: "SOLO", image_category: "random", image_source: "LIBRARY" } : null;
  }

  if (!room) return err("ROOM_NOT_FOUND", "존재하지 않는 방입니다", 404);
  if (room.phase !== "WAITING") return err("PHASE_MISMATCH", "이미 게임이 시작됐습니다");

  const { data: me } = await db
    .from("players").select("id")
    .eq("room_id", room.id).eq("session_id", sessionId)
    .single() as { data: PlayerRow | null };

  if (!me || me.id !== room.host_id) return err("NOT_HOST", "방장만 시작할 수 있습니다", 403);

  const { count: aliveCount } = await db
    .from("players").select("*", { count: "exact", head: true })
    .eq("room_id", room.id).eq("alive", true);

  if ((aliveCount ?? 0) < 3) return err("NOT_ENOUGH_PLAYERS", "3명 이상이어야 시작할 수 있습니다");

  // 팀전 모드: 팀은 입장 시점에 이미 배정되어 대기실에 표시된 상태 (join/bot 라우트 참고).
  // 여기선 재배정하지 않는다 — 대기 중 보여준 팀과 실제 게임 팀이 달라지면 안 되기 때문.
  // 혹시 팀이 비어있는 플레이어만 방어적으로 채운다 (마이그레이션 이전 데이터 등 예외 상황 대비).
  if (room.game_mode === "TEAM") {
    const { data: allPlayers } = await db
      .from("players").select("id,team")
      .eq("room_id", room.id).eq("alive", true)
      .order("joined_at") as { data: Array<{ id: string; team: string | null }> | null };

    if (allPlayers && allPlayers.length >= 2) {
      let aCount = allPlayers.filter((p) => p.team === "A").length;
      let bCount = allPlayers.filter((p) => p.team === "B").length;
      for (const p of allPlayers) {
        if (p.team !== "A" && p.team !== "B") {
          const team = aCount <= bCount ? "A" : "B";
          await db.from("players").update({ team }).eq("id", p.id);
          if (team === "A") aCount++; else bCount++;
        }
      }
    }
  }

  const image = await pickNextImage(db, room.used_images, room.image_category, room.image_source, code.toUpperCase());
  const deadline = new Date(Date.now() + room.write_sec * 1000).toISOString();
  const newRound = room.round + 1;

  await db.from("rooms").update({
    phase: "WRITING", round: newRound, deadline,
    current_image: image?.id ?? null,
    used_images: image ? [...room.used_images, image.id] : room.used_images,
    updated_at: new Date().toISOString(),
  }).eq("code", code.toUpperCase());

  await broadcast(roomChannel(code.toUpperCase()), "PHASE_CHANGED", { phase: "WRITING", round: newRound, deadline });
  if (image) {
    await broadcast(roomChannel(code.toUpperCase()), "IMAGE_REVEALED", { imageUrl: image.url });
  }

  return ok({ started: true });
}
