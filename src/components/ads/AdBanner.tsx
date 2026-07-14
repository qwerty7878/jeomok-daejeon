"use client";
import { GoogleAdBanner } from "./GoogleAdBanner";

const GOOGLE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
const GOOGLE_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT_BANNER;

export function AdBanner() {
  const useGoogle = !!(GOOGLE_CLIENT && GOOGLE_SLOT);
  if (!useGoogle) return null;

  return (
    <div className="flex h-[60px] w-full shrink-0 items-center justify-center overflow-hidden border-t-2 border-foreground/10 bg-muted/40">
      <div className="w-full max-w-[728px]">
        <GoogleAdBanner client={GOOGLE_CLIENT!} slot={GOOGLE_SLOT!} format="horizontal" />
      </div>
    </div>
  );
}
