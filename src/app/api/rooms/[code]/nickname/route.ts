import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { err, ok, getSessionId } from "@/lib/api-helpers";
import { broadcast, roomChannel } from "@/lib/broadcast";

interface PlayerRow { id: string; nickname: string; lives: number; alive: boolean; connected: boolean; }

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const upperCode = code.toUpperCase();
  const sessionId = getSessionId(req);
  if (!sessionId) return err("MISSING_SESSION", "x-session-id required");

  const { nickname } = await req.json() as { nickname: string };
  if (!nickname || nickname.trim().length < 2) return err("INVALID_NICKNAME", "닉네임은 2자 이상이어야 합니다");
  if (nickname.trim().length > 8) return err("INVALID_NICKNAME", "닉네임은 8자 이하여야 합니다");

  const db = createServerClient();
  const { data: room } = await db.from("rooms").select("id,phase").eq("code", upperCode).single() as { data: { id: string; phase: string } | null };
  if (!room) return err("ROOM_NOT_FOUND", "존재하지 않는 방입니다", 404);
  if (room.phase !== "WAITING") return err("PHASE_MISMATCH", "대기 중에만 닉네임을 변경할 수 있습니다");

  const trimmed = nickname.trim();

  // 중복 닉네임 체크
  const { data: dup } = await db.from("players").select("id").eq("room_id", room.id).eq("nickname", trimmed).single();
  if (dup) return err("DUPLICATE_NICKNAME", "이미 사용 중인 닉네임입니다");

  await db.from("players").update({ nickname: trimmed }).eq("room_id", room.id).eq("session_id", sessionId);

  // localStorage 닉네임도 서버 변경에 맞추도록 클라이언트가 별도 처리
  const { data: allPlayers } = await db.from("players").select("id,nickname,lives,alive,connected").eq("room_id", room.id) as { data: PlayerRow[] | null };
  await broadcast(roomChannel(upperCode), "PLAYER_UPDATE", { players: allPlayers });

  return ok({ nickname: trimmed });
}
