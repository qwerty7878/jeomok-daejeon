"use client";
import { createClient } from "@supabase/supabase-js";

let _client: ReturnType<typeof createClient> | null = null;

// anon 키 — Realtime 구독 전용 (읽기 전용 소켓)
export function getSupabaseClient() {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _client;
}
