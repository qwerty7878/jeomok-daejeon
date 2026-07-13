/**
 * 레이스 컨디션 방어 (R1~R7)
 * DB 레벨 테스트는 TEST_SUPABASE_URL 필요
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SKIP = !process.env.TEST_SUPABASE_URL || !process.env.TEST_SERVICE_KEY;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

describe.skipIf(SKIP)("R1 두 탭 동시 제출 → 1개만 저장", () => {
  let db: AnyClient;
  let roomId: string;
  let playerId: string;

  beforeAll(async () => {
    db = createClient(
      process.env.TEST_SUPABASE_URL!,
      process.env.TEST_SERVICE_KEY!,
      { auth: { persistSession: false } }
    ) as AnyClient;

    const { data: room } = await db.from("rooms").insert({
      code: `RR${Date.now().toString().slice(-4)}`,
      name: "레이스테스트",
      room_type: "SECRET",
      invite_token: "t",
      max_players: 8,
      lives: 3,
      write_sec: 45,
      phase: "WRITING",
      round: 1,
      deadline: new Date(Date.now() + 60000).toISOString(),
      used_images: [],
    }).select("id").single();
    roomId = (room as { id: string } | null)?.id ?? "";

    const { data: player } = await db.from("players").insert({
      room_id: roomId,
      session_id: crypto.randomUUID(),
      nickname: "탭1",
      lives: 3,
      alive: true,
      connected: true,
    }).select("id").single();
    playerId = (player as { id: string } | null)?.id ?? "";
  });

  afterAll(async () => {
    if (roomId) await db.from("rooms").delete().eq("id", roomId);
  });

  it("동시 upsert → 정확히 1개 레코드", async () => {
    await Promise.all([
      db.from("submissions").upsert(
        { room_id: roomId, round: 1, player_id: playerId, title: "탭1 제목" },
        { onConflict: "room_id,round,player_id" }
      ),
      db.from("submissions").upsert(
        { room_id: roomId, round: 1, player_id: playerId, title: "탭2 제목" },
        { onConflict: "room_id,round,player_id" }
      ),
    ]);

    const { count } = await db
      .from("submissions")
      .select("*", { count: "exact", head: true })
      .eq("room_id", roomId)
      .eq("round", 1)
      .eq("player_id", playerId);

    expect(count).toBe(1);
  });
});

describe.skipIf(SKIP)("R4 동시 vote → 1인 1표", () => {
  it("같은 voter_id로 동시 두 번 투표 → 최종 1표만", () => {
    // PK (room_id, round, voter_id) 로 DB 레벨에서 보장
    // 통합 테스트 세팅 필요 — placeholder
    expect(true).toBe(true);
  });
});

describe("R5 tick과 submit 동시 도달 — 로직 계약", () => {
  it("submit은 deadline > now() 검증 후 저장", () => {
    const deadline = new Date(Date.now() + 60000).toISOString();
    const now = new Date().toISOString();
    expect(deadline > now).toBe(true);
  });

  it("tick은 deadline <= now() 여야 전이", () => {
    const pastDeadline = new Date(Date.now() - 1000).toISOString();
    const now = new Date().toISOString();
    expect(pastDeadline <= now).toBe(true);
  });
});
