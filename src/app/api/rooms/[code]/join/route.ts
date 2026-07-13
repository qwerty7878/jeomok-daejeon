import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { err, ok, getSessionId } from "@/lib/api-helpers";
import { broadcast, roomChannel } from "@/lib/broadcast";
import bcrypt from "bcrypt";

interface RoomRow {
  id: string; room_type: string; invite_token: string;
  password_hash: string | null; max_players: number;
  phase: string; host_id: string | null; lives: number;
}
interface AttemptRow { fails: number; locked_until: string | null; }
interface PlayerRow {
  id: string; session_id: string; alive: boolean; connected: boolean;
  nickname: string; lives: number;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const upperCode = code.toUpperCase();
  const sessionId = getSessionId(req);
  if (!sessionId) return err("MISSING_SESSION", "x-session-id required");

  const body = await req.json();
  const { nickname, password, inviteToken } = body as {
    nickname: string; password?: string; inviteToken?: string;
  };

  if (!nickname || nickname.trim().length < 2) {
    return err("INVALID_NICKNAME", "닉네임은 2자 이상이어야 합니다");
  }

  const db = createServerClient();
  const { data: room } = await db
    .from("rooms")
    .select("id,room_type,invite_token,password_hash,max_players,phase,host_id,lives")
    .eq("code", upperCode)
    .single() as { data: RoomRow | null };

  if (!room) return err("ROOM_NOT_FOUND", "존재하지 않는 방입니다", 404);

  if (room.room_type === "LOCKED" || room.room_type === "SECRET") {
    const tokenValid = inviteToken && inviteToken === room.invite_token;
    if (!tokenValid) {
      const { data: attempt } = await db
        .from("password_attempts")
        .select("fails,locked_until")
        .eq("room_code", upperCode).eq("session_id", sessionId)
        .maybeSingle() as { data: AttemptRow | null };

      if (attempt?.locked_until && new Date(attempt.locked_until) > new Date()) {
        const retryAfterSec = Math.ceil((new Date(attempt.locked_until).getTime() - Date.now()) / 1000);
        return err("PASSWORD_COOLDOWN", `잠시 후 다시 시도해주세요 (${retryAfterSec}초)`, 429);
      }

      const match = room.password_hash
        ? await bcrypt.compare(String(password ?? ""), room.password_hash)
        : true;

      if (!match) {
        const fails = (attempt?.fails ?? 0) + 1;
        const lockedUntil = fails >= 5 ? new Date(Date.now() + 60000).toISOString() : null;
        await db.from("password_attempts").upsert(
          { room_code: upperCode, session_id: sessionId, fails, locked_until: lockedUntil },
          { onConflict: "room_code,session_id" }
        );
        return err("WRONG_PASSWORD", `비밀번호가 틀렸습니다 (${fails}/5)`);
      }

      if (attempt) {
        await db.from("password_attempts")
          .update({ fails: 0, locked_until: null })
          .eq("room_code", upperCode).eq("session_id", sessionId);
      }
    }
  }

  // 재접속 확인
  const { data: existing } = await db
    .from("players").select("id,alive,connected,nickname,lives")
    .eq("room_id", room.id).eq("session_id", sessionId)
    .maybeSingle() as { data: PlayerRow | null };

  if (existing) {
    await db.from("players").update({ connected: true }).eq("id", existing.id);
    return ok({ playerId: existing.id, asSpectator: !existing.alive });
  }

  const { count } = await db
    .from("players").select("*", { count: "exact", head: true })
    .eq("room_id", room.id);

  const isPlaying = room.phase !== "WAITING";
  const asSpectator = isPlaying || (count ?? 0) >= room.max_players;

  if (!asSpectator && (count ?? 0) >= room.max_players) {
    return err("ROOM_FULL", "방이 꽉 찼습니다", 409);
  }

  // 닉네임 중복
  let finalNickname = nickname.trim().slice(0, 8);
  const { data: conflict } = await db
    .from("players").select("nickname")
    .eq("room_id", room.id).eq("nickname", finalNickname)
    .maybeSingle() as { data: { nickname: string } | null };
  if (conflict) finalNickname = `${finalNickname}(2)`;

  const { data: player } = await db
    .from("players")
    .insert({
      room_id: room.id, session_id: sessionId, nickname: finalNickname,
      lives: asSpectator ? 0 : room.lives, alive: !asSpectator, connected: true,
    })
    .select("id").single() as { data: { id: string } | null };

  if (!player) return err("DB_ERROR", "입장에 실패했습니다", 500);

  if (!room.host_id) {
    await db.from("rooms").update({ host_id: player.id }).eq("code", upperCode);
  }

  const { data: allPlayers } = await db
    .from("players").select("id,nickname,lives,alive,connected")
    .eq("room_id", room.id) as { data: PlayerRow[] | null };

  const hostId = room.host_id ?? player.id;
  await broadcast(roomChannel(upperCode), "PLAYER_UPDATE", {
    players: (allPlayers ?? []).map((p) => ({ ...p, isHost: p.id === hostId })),
  });

  return ok({ playerId: player.id, asSpectator });
}
