import { NextRequest, NextResponse } from "next/server";

function isAdmin(req: NextRequest): boolean {
  return req.headers.get("x-admin-secret") === process.env.ADMIN_SECRET;
}

// Supabase postgres direct connection via service_role
// DDL via postgres REST
async function runSQL(sql: string): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  // Use Supabase SQL REST endpoint (available with service role)
  const res = await fetch(`${url}/rest/v1/rpc/query`, {
    method: "POST",
    headers: {
      "apikey": key,
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: sql }),
  });
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: text };
  }
  return { ok: true };
}

const MIGRATIONS = [
  // images table
  `ALTER TABLE images ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'art'`,
  `ALTER TABLE images ADD COLUMN IF NOT EXISTS room_id text REFERENCES rooms(code) ON DELETE CASCADE`,
  // rooms table
  `ALTER TABLE rooms ADD COLUMN IF NOT EXISTS image_source text NOT NULL DEFAULT 'LIBRARY' CHECK (image_source IN ('LIBRARY','CUSTOM'))`,
  `ALTER TABLE rooms ADD COLUMN IF NOT EXISTS image_category text NOT NULL DEFAULT 'random'`,
  `ALTER TABLE rooms ADD COLUMN IF NOT EXISTS game_mode text NOT NULL DEFAULT 'SOLO' CHECK (game_mode IN ('SOLO','TEAM'))`,
  // players table
  `ALTER TABLE players ADD COLUMN IF NOT EXISTS team text CHECK (team IN ('A','B'))`,
  // reports table
  `CREATE TABLE IF NOT EXISTS reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_code char(6),
    reporter_session text NOT NULL,
    target_type text NOT NULL CHECK (target_type IN ('chat','title')),
    target_content text NOT NULL,
    context text,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','dismissed')),
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `ALTER TABLE reports ENABLE ROW LEVEL SECURITY`,
  // last_round_result snapshot (재접속 시 재계산 대신 사용)
  `ALTER TABLE rooms ADD COLUMN IF NOT EXISTS last_round_result jsonb`,
];

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const results: Array<{ sql: string; ok: boolean; error?: string }> = [];
  for (const sql of MIGRATIONS) {
    const result = await runSQL(sql);
    results.push({ sql: sql.slice(0, 60), ...result });
  }

  return NextResponse.json({ results });
}
