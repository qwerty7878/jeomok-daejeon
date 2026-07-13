"use client";
import Script from "next/script";

interface Props {
  unit: string;
  width: number;
  height: number;
}

export function KakaoAdBanner({ unit, width, height }: Props) {
  return (
    <>
      <ins
        className="kakao_ad_area"
        style={{ display: "none" }}
        data-ad-unit={unit}
        data-ad-width={String(width)}
        data-ad-height={String(height)}
      />
      <Script
        src="//t1.kakaocdn.net/kas/static/ba.min.js"
        strategy="afterInteractive"
      />
    </>
  );
}
