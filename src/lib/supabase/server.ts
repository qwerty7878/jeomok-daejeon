import { createClient } from "@supabase/supabase-js";

// service_role 키 사용 — 서버 전용(Route Handler, Server Component)에서만 호출. 클라이언트 번들에 노출 금지
// DB 타입은 쿼리마다 명시적으로 선언 (join 때문에 제네릭 불사용)
export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase 환경변수 없음");
  return createClient(url, key, { auth: { persistSession: false } });
}

export type SupabaseServerClient = ReturnType<typeof createServerClient>;
