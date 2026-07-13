import { ImageResponse } from "@vercel/og";
import { createServerClient } from "@/lib/supabase/server";

export const runtime = "edge";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const db = createServerClient();
  const { data: result } = await db
    .from("game_results")
    .select("winners, player_count, round_count, duration_sec, room_code")
    .eq("id", id)
    .single();

  const winners: string[] = result?.winners ?? ["???"];
  const playerCount: number = result?.player_count ?? 0;
  const roundCount: number = result?.round_count ?? 0;
  const durMin = result?.duration_sec ? Math.round(result.duration_sec / 60) : 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          background: "#faf6f0",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "serif",
          gap: "24px",
          padding: "60px",
          border: "12px solid #1a1008",
        }}
      >
        {/* Title */}
        <div style={{ fontSize: "32px", color: "#6b4226", letterSpacing: "0.12em", display: "flex" }}>
          제목대전
        </div>

        {/* Trophy */}
        <div style={{ fontSize: "64px", display: "flex" }}>🏆</div>

        {/* Winners */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px",
          }}
        >
          {winners.map((w) => (
            <div
              key={w}
              style={{
                fontSize: "56px",
                fontWeight: "bold",
                color: "#1a1008",
                letterSpacing: "-0.02em",
                display: "flex",
              }}
            >
              {w}
            </div>
          ))}
          <div style={{ fontSize: "24px", color: "#9a7a5c", display: "flex" }}>
            {winners.length > 1 ? "공동 우승" : "최후의 1인"}
          </div>
        </div>

        {/* Stats */}
        <div
          style={{
            display: "flex",
            gap: "40px",
            marginTop: "8px",
          }}
        >
          {[
            { label: "참가자", value: `${playerCount}명` },
            { label: "라운드", value: `${roundCount}R` },
            { label: "소요시간", value: `${durMin}분` },
          ].map(({ label, value }) => (
            <div
              key={label}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "4px",
                background: "#ede8df",
                borderRadius: "16px",
                padding: "16px 28px",
              }}
            >
              <div style={{ fontSize: "14px", color: "#9a7a5c", display: "flex" }}>{label}</div>
              <div style={{ fontSize: "28px", fontWeight: "bold", color: "#1a1008", display: "flex" }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
