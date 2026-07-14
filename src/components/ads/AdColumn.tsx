"use client";
import { GoogleAdBanner } from "./GoogleAdBanner";

const GOOGLE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
const GOOGLE_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT_COLUMN;

export function AdColumn() {
  const useGoogle = !!(GOOGLE_CLIENT && GOOGLE_SLOT);
  if (!useGoogle) return null;

  return (
    <div className="flex h-full w-full flex-col items-center overflow-hidden pt-3">
      <GoogleAdBanner client={GOOGLE_CLIENT!} slot={GOOGLE_SLOT!} format="rectangle" />
    </div>
  );
}
