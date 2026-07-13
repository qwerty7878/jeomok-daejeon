"use client";
import { useEffect } from "react";
import Script from "next/script";

interface Props {
  client: string;
  slot: string;
  format?: "auto" | "rectangle" | "horizontal";
}

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
    <>
      <Script
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}
        strategy="afterInteractive"
        crossOrigin="anonymous"
      />
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </>
  );
}
