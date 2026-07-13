// Supabase Realtime HTTP Broadcast — Route Handler에서만 호출
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function broadcast(channel: string, event: string, payload: unknown) {
  const res = await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
    },
    body: JSON.stringify({
      messages: [{ topic: channel, event, payload }],
    }),
  });
  if (!res.ok) {
    console.error("broadcast failed", channel, event, await res.text());
  }
}

export const roomChannel = (code: string) => `room:${code}`;
