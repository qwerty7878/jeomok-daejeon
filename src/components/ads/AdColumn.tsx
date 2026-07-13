"use client";
import { KakaoAdBanner } from "./KakaoAdBanner";
import { GoogleAdBanner } from "./GoogleAdBanner";

const KAKAO_UNIT = process.env.NEXT_PUBLIC_KAKAO_ADFIT_UNIT_COLUMN;
const GOOGLE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
const GOOGLE_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT_COLUMN;

export function AdColumn() {
  const useGoogle = !!(GOOGLE_CLIENT && GOOGLE_SLOT);
  const useKakao = !useGoogle && !!KAKAO_UNIT;

  if (!useGoogle && !useKakao) return null;

  return (
    <div className="flex h-full w-full flex-col items-center overflow-hidden pt-3">
      {useGoogle && (
        <GoogleAdBanner client={GOOGLE_CLIENT!} slot={GOOGLE_SLOT!} format="rectangle" />
      )}
      {useKakao && (
        <KakaoAdBanner unit={KAKAO_UNIT!} width={160} height={600} />
      )}
    </div>
  );
}
