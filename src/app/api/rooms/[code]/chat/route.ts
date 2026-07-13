import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { err, ok, getSessionId } from "@/lib/api-helpers";
import { broadcast, roomChannel } from "@/lib/broadcast";

const rateLimitMap = new Map<string, number>();

interface RoomRow { id: string; phase: string; }
interface PlayerRow { id: string; nickname: string; alive: boolean; }

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const upperCode = code.toUpperCase();
  const sessionId = getSessionId(req);
  if (!sessionId) return err("MISSING_SESSION", "x-session-id required");

  const body = await req.json();
  const { message } = body as { message: string };

  if (!message || message.trim().length === 0) return err("INVALID_MESSAGE", "메시지를 입력해주세요");
  if (message.length > 100) return err("INVALID_MESSAGE", "메시지는 100자 이하여야 합니다");

  const key = `${upperCode}:${sessionId}`;
  const last = rateLimitMap.get(key) ?? 0;
  if (Date.now() - last < 1000) return err("RATE_LIMITED", "너무 빠릅니다", 429);
  rateLimitMap.set(key, Date.now());

  const db = createServerClient();
  const { data: room } = await db
    .from("rooms").select("id,phase")
    .eq("code", upperCode).single() as { data: RoomRow | null };

  if (!room) return err("ROOM_NOT_FOUND", "존재하지 않는 방입니다", 404);

  // VOTING 채팅 차단 ★ 서버 레벨 강제
  if (room.phase === "VOTING") return err("CHAT_LOCKED", "투표 중에는 채팅할 수 없습니다", 403);

  const { data: player } = await db
    .from("players").select("id,nickname,alive")
    .eq("room_id", room.id).eq("session_id", sessionId)
    .single() as { data: PlayerRow | null };

  if (!player) return err("NOT_IN_ROOM", "이 방의 플레이어가 아닙니다", 403);

  // WRITING: 미제출 생존자 채팅 차단 (room.round 필요 → 별도 조회)
  // phase=WRITING이고 생존자인데 미제출이면 차단
  // (실제 round는 room select에서 가져와야 함 — 현재 구조상 phase만 가져옴)
  // CH-04는 P1 기능 — VOTING 차단(CH-03)만 P0 MVP 필수

  await broadcast(roomChannel(upperCode), "CHAT", {
    nickname: player.nickname,
    message: message.trim(),
    at: new Date().toISOString(),
    alive: player.alive,
  });

  return ok({ sent: true });
}
