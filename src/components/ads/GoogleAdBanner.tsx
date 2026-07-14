"use client";
import { useEffect } from "react";

interface Props {
  client: string;
  slot: string;
  format?: "auto" | "rectangle" | "horizontal";
}

// 스크립트 로딩은 layout.tsx가 페이지당 1회만 담당한다 — 여기서 다시 <Script>를 넣으면
// 인스턴스 수만큼(방 페이지는 4개) 중복 삽입돼 애드센스 정책 위반 소지가 있다.
export function GoogleAdBanner({ client, slot, format = "auto" }: Props) {
  useEffect(() => {
    try {
      const w = window as { adsbygoogle?: unknown[] };
      w.adsbygoogle = w.adsbygoogle ?? [];
      w.adsbygoogle.push({});
    } catch {
      // adsbygoogle not yet loaded
    }
  }, []);

  return (
    <ins
      className="adsbygoogle"
      style={{ display: "block" }}
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive="true"
    />
  );
}
