import type { Metadata } from "next";
import { Gaegu, Gothic_A1 } from "next/font/google";
import "./globals.css";

const gaegu = Gaegu({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-hand",
  display: "swap",
});

const gothic = Gothic_A1({
  weight: ["400", "500", "700", "800", "900"],
  subsets: ["latin"],
  variable: "--font-gothic",
  display: "swap",
});

export const metadata: Metadata = {
  title: "제목대전",
  description:
    "사진에 제목을 붙이고, 가장 웃긴 제목에 투표하세요. 실시간 멀티플레이 파티 게임.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`light ${gaegu.variable} ${gothic.variable}`}
    >
      <body className="min-h-dvh bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
