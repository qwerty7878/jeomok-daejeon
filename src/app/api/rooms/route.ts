import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { err, ok, generateRoomCode, getSessionId } from "@/lib/api-helpers";
import { broadcast } from "@/lib/broadcast";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcrypt";

export async function GET() {
  const db = createServerClient();
  const { data, error } = await db
    .from("rooms")
    .select("code, name, room_type, max_players, phase")
    .in("room_type", ["PUBLIC", "LOCKED"])
    .eq("phase", "WAITING")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) return err("DB_ERROR", error.message, 500);

  const rooms = await Promise.all(
    (data ?? []).map(async (r) => {
      const { count } = await db
        .from("players")
        .select("*", { count: "exact", head: true })
        .eq("room_id", r.code);
      return {
        code: r.code,
        name: r.name,
        roomType: r.room_type,
        playerCount: count ?? 0,
        maxPlayers: r.max_players,
        status:
          r.phase === "WAITING"
            ? "WAITING"
            : count === r.max_players
            ? "FULL"
            : "PLAYING",
      };
    })
  );

  return ok({ rooms });
}

export async function POST(req: NextRequest) {
  const sessionId = getSessionId(req);
  if (!sessionId) return err("MISSING_SESSION", "x-session-id required");

  const body = await req.json();
  const {
    name, maxPlayers = 8, roomType = "PUBLIC", password, lives = 3, writeSec = 45,
    imageSource = "LIBRARY", imageCategory = "random", gameMode = "SOLO",
  } = body;

  if (!name || typeof name !== "string" || name.trim().length < 1) {
    return err("INVALID_NAME", "방 이름을 입력해주세요");
  }
  if (roomType === "LOCKED" && !password) {
    return err("PASSWORD_REQUIRED", "잠금방에는 비밀번호가 필요합니다");
  }

  const db = createServerClient();

  // 중복 코드 방지
  let code = generateRoomCode();
  for (let i = 0; i < 5; i++) {
    const { data } = await db.from("rooms").select("code").eq("code", code).maybeSingle();
    if (!data) break;
    code = generateRoomCode();
  }

  const inviteToken = uuidv4();
  const passwordHash = password ? await bcrypt.hash(String(password), 10) : null;

  const baseInsert = {
    code,
    name: name.trim().slice(0, 20),
    room_type: roomType,
    password_hash: passwordHash,
    invite_token: inviteToken,
    max_players: Math.min(12, Math.max(3, Number(maxPlayers))),
    lives: Math.min(5, Math.max(2, Number(lives))),
    write_sec: [30, 45, 60].includes(Number(writeSec)) ? Number(writeSec) : 45,
    host_id: null,
    phase: "WAITING",
    round: 0,
    deadline: null,
    current_image: null,
    used_images: [],
  };

  // 마이그레이션 완료 후 새 컬럼 포함 (없으면 fallback)
  const fullInsert = {
    ...baseInsert,
    image_source: ["LIBRARY", "CUSTOM"].includes(String(imageSource)) ? imageSource : "LIBRARY",
    image_category: ["random", "art", "nature", "people", "animals", "other"].includes(String(imageCategory)) ? imageCategory : "random",
    game_mode: ["SOLO", "TEAM"].includes(String(gameMode)) ? gameMode : "SOLO",
  };

  let { error } = await db.from("rooms").insert(fullInsert);

  // 새 컬럼이 아직 없는 경우 (migration 전) fallback
  const isMissingColumnErr = (e: unknown) => {
    const msg = (e as { message?: string })?.message ?? "";
    return msg.includes("Could not find the") || msg.includes("does not exist");
  };
  if (isMissingColumnErr(error)) {
    const fallback = await db.from("rooms").insert(baseInsert);
    error = fallback.error;
  }

  if (error) return err("DB_ERROR", error.message, 500);

  if (roomType !== "SECRET") {
    await broadcast("lobby", "ROOM_ADDED", { code, name: name.trim(), roomType });
  }

  return ok({ code, inviteToken }, 201);
}
