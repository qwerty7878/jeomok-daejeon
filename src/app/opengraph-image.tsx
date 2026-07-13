import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "제목대전 — 실시간 제목 짓기 파티 게임";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 40%, #f59e0b 100%)",
          fontFamily: "sans-serif",
        }}
      >
        {/* 배경 장식 */}
        <div
          style={{
            position: "absolute",
            top: 40,
            left: 60,
            fontSize: 80,
            opacity: 0.15,
          }}
        >
          📸
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 50,
            right: 80,
            fontSize: 80,
            opacity: 0.15,
          }}
        >
          🏆
        </div>

        {/* 메인 카드 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            background: "rgba(255,255,255,0.85)",
            borderRadius: 32,
            padding: "60px 80px",
            border: "4px solid #d97706",
            boxShadow: "8px 10px 0 0 rgba(120,80,0,0.2)",
          }}
        >
          <div style={{ fontSize: 72, fontWeight: 900, color: "#92400e", letterSpacing: "-2px" }}>
            제목대전
          </div>
          <div style={{ fontSize: 28, color: "#78350f", marginTop: 16, textAlign: "center" }}>
            사진에 제목을 붙이고 투표하는
          </div>
          <div style={{ fontSize: 28, color: "#78350f", textAlign: "center" }}>
            실시간 멀티플레이 파티게임
          </div>

          {/* 태그 배지들 */}
          <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
            {["👥 멀티플레이", "⚡ 실시간", "😂 유머", "🗳️ 투표"].map((tag) => (
              <div
                key={tag}
                style={{
                  background: "#f59e0b",
                  color: "#fff",
                  borderRadius: 20,
                  padding: "8px 20px",
                  fontSize: 20,
                  fontWeight: 700,
                }}
              >
                {tag}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
