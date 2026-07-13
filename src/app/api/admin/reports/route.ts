import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { err, ok } from "@/lib/api-helpers";

function isAdmin(req: NextRequest): boolean {
  const secret = req.headers.get("x-admin-secret");
  return secret === process.env.ADMIN_SECRET;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return err("FORBIDDEN", "관리자 권한 없음", 403);

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "pending";
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const limit = 30;
  const offset = (page - 1) * limit;

  const db = createServerClient();
  const { data, count, error } = await db
    .from("reports")
    .select("*", { count: "exact" })
    .eq("status", status)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return err("DB_ERROR", error.message, 500);
  return ok({ reports: data ?? [], total: count ?? 0, page, limit });
}

export async function PATCH(req: NextRequest) {
  if (!isAdmin(req)) return err("FORBIDDEN", "관리자 권한 없음", 403);

  const body = await req.json() as { id: string; status: "reviewed" | "dismissed" };
  if (!body.id || !["reviewed", "dismissed"].includes(body.status)) {
    return err("INVALID_BODY", "id and status required", 400);
  }

  const db = createServerClient();
  const { error } = await db.from("reports").update({ status: body.status }).eq("id", body.id);
  if (error) return err("DB_ERROR", error.message, 500);
  return ok({ updated: true });
}

// Admin stats
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return err("FORBIDDEN", "관리자 권한 없음", 403);

  const db = createServerClient();
  const [{ count: pending }, { count: totalRooms }, { count: totalGames }, { data: recentRooms }] =
    await Promise.all([
      db.from("reports").select("*", { count: "exact", head: true }).eq("status", "pending"),
      db.from("rooms").select("*", { count: "exact", head: true }),
      db.from("game_results").select("*", { count: "exact", head: true }),
      db.from("rooms").select("code,name,phase,created_at").order("created_at", { ascending: false }).limit(20),
    ]);

  return NextResponse.json({
    pendingReports: pending ?? 0,
    totalRooms: totalRooms ?? 0,
    totalGames: totalGames ?? 0,
    recentRooms: recentRooms ?? [],
  });
}
