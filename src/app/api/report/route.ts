import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { err, ok, getSessionId } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  const sessionId = getSessionId(req);
  if (!sessionId) return err("MISSING_SESSION", "x-session-id required");

  const body = await req.json() as {
    roomCode?: string;
    targetType: "chat" | "title";
    targetContent: string;
    context?: string;
  };

  const { roomCode, targetType, targetContent, context } = body;
  if (!targetType || !targetContent) {
    return err("INVALID_BODY", "targetType, targetContent required", 400);
  }
  if (!["chat", "title"].includes(targetType)) {
    return err("INVALID_TYPE", "targetType must be chat or title", 400);
  }
  if (typeof targetContent !== "string" || targetContent.trim().length === 0) {
    return err("EMPTY_CONTENT", "신고 내용이 없습니다", 400);
  }

  const db = createServerClient();

  // 같은 세션이 같은 내용을 1시간 내 중복 신고 방지
  const { count: recent } = await db
    .from("reports")
    .select("*", { count: "exact", head: true })
    .eq("reporter_session", sessionId)
    .eq("target_content", targetContent.trim())
    .gte("created_at", new Date(Date.now() - 3600000).toISOString());

  if ((recent ?? 0) > 0) return err("ALREADY_REPORTED", "이미 신고한 내용입니다", 409);

  await db.from("reports").insert({
    room_code: roomCode ?? null,
    reporter_session: sessionId,
    target_type: targetType,
    target_content: targetContent.trim().slice(0, 200),
    context: context?.trim().slice(0, 100) ?? null,
    status: "pending",
  });

  return ok({ reported: true });
}
