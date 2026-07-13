import type { Metadata } from "next";
import { Gaegu, Gothic_A1 } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import Script from "next/script";
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

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://jeomok-daejeon.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "제목대전",
    template: "%s | 제목대전",
  },
  description:
    "사진 한 장에 제목을 붙이고, 가장 웃긴 제목에 투표하세요. 최하위 득표자가 목숨을 잃는 실시간 멀티플레이 파티 게임.",
  keywords: ["제목대전", "파티게임", "멀티플레이", "실시간게임", "웹게임", "친구게임", "제목짓기", "투표게임"],
  authors: [{ name: "제목대전" }],
  creator: "제목대전",
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: APP_URL,
    siteName: "제목대전",
    title: "제목대전 — 사진에 제목을 붙이고 투표하는 파티게임",
    description:
      "사진 한 장에 제목을 붙이고, 가장 웃긴 제목에 투표하세요. 최하위 득표자가 목숨을 잃는 실시간 멀티플레이 파티 게임.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "제목대전 — 실시간 제목 짓기 파티 게임",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "제목대전 — 사진에 제목을 붙이고 투표하는 파티게임",
    description:
      "사진 한 장에 제목을 붙이고, 가장 웃긴 제목에 투표하세요. 실시간 멀티플레이 파티 게임.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: APP_URL,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "제목대전",
  url: APP_URL,
  description:
    "사진 한 장에 제목을 붙이고, 가장 웃긴 제목에 투표하세요. 최하위 득표자가 목숨을 잃는 실시간 멀티플레이 파티 게임.",
  applicationCategory: "GameApplication",
  operatingSystem: "Web",
  inLanguage: "ko",
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
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
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {process.env.NEXT_PUBLIC_ADSENSE_CLIENT && (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_CLIENT}`}
            crossOrigin="anonymous"
          />
        )}
      </head>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        {children}
      </body>
      {process.env.NEXT_PUBLIC_GA_ID && (
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
      )}
    </html>
  );
}
