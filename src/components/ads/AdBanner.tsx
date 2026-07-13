"use client";
import { KakaoAdBanner } from "./KakaoAdBanner";
import { GoogleAdBanner } from "./GoogleAdBanner";

const KAKAO_UNIT = process.env.NEXT_PUBLIC_KAKAO_ADFIT_UNIT_BANNER;
const GOOGLE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
const GOOGLE_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT_BANNER;

// Google 우선 → 없으면 Kakao. 절대 동시에 2개 안 뜸.
export function AdBanner() {
  const useGoogle = !!(GOOGLE_CLIENT && GOOGLE_SLOT);
  const useKakao = !useGoogle && !!KAKAO_UNIT;

  if (!useGoogle && !useKakao) return null;

  return (
    <div className="flex h-[60px] w-full shrink-0 items-center justify-center overflow-hidden border-t-2 border-foreground/10 bg-muted/40">
      {useGoogle && (
        <div className="w-full max-w-[728px]">
          <GoogleAdBanner client={GOOGLE_CLIENT!} slot={GOOGLE_SLOT!} format="horizontal" />
        </div>
      )}
      {useKakao && (
        <KakaoAdBanner unit={KAKAO_UNIT!} width={320} height={50} />
      )}
    </div>
  );
}
