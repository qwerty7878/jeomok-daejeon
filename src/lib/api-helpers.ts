import { NextRequest, NextResponse } from "next/server";
import type { ApiError } from "@/types/game";

export function getSessionId(req: NextRequest): string | null {
  return req.headers.get("x-session-id");
}

export function err(code: string, message: string, status = 400): NextResponse<ApiError> {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function ok<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status });
}

// 6자리 방 코드 생성 (0 O 1 I 제외)
const CHARSET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return code;
}
