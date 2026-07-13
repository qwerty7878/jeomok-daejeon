/**
 * T002 검증: tick 원자성
 * 10개 병렬 tick → 전이 정확히 1회만 발생해야 한다.
 *
 * 실행 방법: TEST_SUPABASE_URL=... TEST_SERVICE_KEY=... pnpm test tests/atomicity.test.ts
 * DB 없이는 skip.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SKIP = !process.env.TEST_SUPABASE_URL || !process.env.TEST_SERVICE_KEY;

// 타입 단언용 헬퍼
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

describe.skipIf(SKIP)("T002 tick 원자성", () => {
  let db: AnyClient;
  let roomCode: string;
  let roomId: string;

  beforeAll(async () => {
    db = createClient(
      process.env.TEST_SUPABASE_URL!,
      process.env.TEST_SERVICE_KEY!,
      { auth: { persistSession: false } }
    ) as AnyClient;

    roomCode = `TST${Math.floor(Math.random() * 999).toString().padStart(3, "0")}`;
    const pastDeadline = new Date(Date.now() - 5000).toISOString();

    const { data, error } = await db.from("rooms").insert({
      code: roomCode,
      name: "원자성 테스트",
      room_type: "SECRET",
      invite_token: "test-token",
      max_players: 8,
      lives: 3,
      write_sec: 45,
      phase: "WRITING",
      round: 1,
      deadline: pastDeadline,
      used_images: [],
    }).select("id").single();

    if (error || !data) throw new Error(`방 생성 실패: ${String(error?.message)}`);
    roomId = (data as { id: string }).id;
  });

  afterAll(async () => {
    if (roomId) {
      await db.from("rooms").delete().eq("id", roomId);
    }
  });

  it("10개 병렬 tick → 정확히 1개만 전이 성공", async () => {
    const nextDeadline = new Date(Date.now() + 30000).toISOString();

    const results = await Promise.all(
      Array.from({ length: 10 }, async () => {
        const { data } = await db
          .from("rooms")
          .update({ phase: "VOTING", deadline: nextDeadline })
          .eq("code", roomCode)
          .eq("phase", "WRITING")
          .eq("round", 1)
          .lte("deadline", new Date().toISOString())
          .select("id")
          .maybeSingle();
        return data !== null;
      })
    );

    const successCount = results.filter(Boolean).length;
    expect(successCount).toBe(1);

    const { data: room } = await db.from("rooms").select("phase").eq("id", roomId).single();
    expect((room as { phase: string } | null)?.phase).toBe("VOTING");
  });
});
