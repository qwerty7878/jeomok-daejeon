import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { broadcast } from "@/lib/broadcast";

// Vercel Cron이 매 시간 호출 — CRON_SECRET으로 인증
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServerClient();
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2시간 전

  // WAITING인 채로 2시간 이상 지난 방 (아무도 시작 안 한 유령 방)
  const { data: staleWaiting } = await db
    .from("rooms")
    .select("code")
    .eq("phase", "WAITING")
    .lt("updated_at", cutoff);

  // GAME_OVER 후 1시간 이상 지난 방
  const cutoffGameOver = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: staleGameOver } = await db
    .from("rooms")
    .select("code")
    .eq("phase", "GAME_OVER")
    .lt("updated_at", cutoffGameOver);

  const toDelete = [
    ...(staleWaiting ?? []),
    ...(staleGameOver ?? []),
  ].map((r) => r.code);

  if (toDelete.length > 0) {
    // 삭제 전 ROOM_CLOSED broadcast (연결된 클라이언트가 있을 수 있음)
    await Promise.all(
      toDelete.map((code) =>
        broadcast(`room:${code}`, "ROOM_CLOSED", { reason: "cleanup" }).catch(() => {})
      )
    );

    await db.from("rooms").delete().in("code", toDelete);
  }

  return NextResponse.json({ deleted: toDelete.length, codes: toDelete });
}
