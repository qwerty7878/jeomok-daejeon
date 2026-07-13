// Vitest setup
// 실제 DB 없이 돌리는 테스트는 mock을 쓴다.
// 통합 테스트(atomicity, scoring 등)는 TEST_SUPABASE_URL / TEST_SERVICE_KEY 필요.
import { vi } from "vitest";

if (!process.env.TEST_SUPABASE_URL) {
  console.warn("[setup] TEST_SUPABASE_URL 없음 → DB 테스트는 skip됩니다.");
}
