"use client";
import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { KakaoAdBanner } from "./KakaoAdBanner";
import { GoogleAdBanner } from "./GoogleAdBanner";

const KAKAO_UNIT = process.env.NEXT_PUBLIC_KAKAO_ADFIT_UNIT_INTER;
const GOOGLE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
const GOOGLE_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT_INTER;

const GAME_COUNT_KEY = "jdj_game_count";
const AD_EVERY_N_GAMES = 3;
const CLOSE_DELAY_SEC = 5;

export function useGameEndAd() {
  const [showAd, setShowAd] = useState(false);
  const triggered = useRef(false);

  useEffect(() => {
    if (triggered.current) return;
    triggered.current = true;

    const hasAd = !!KAKAO_UNIT || !!(GOOGLE_CLIENT && GOOGLE_SLOT);
    if (!hasAd) return;

    try {
      const prev = parseInt(localStorage.getItem(GAME_COUNT_KEY) ?? "0", 10);
      const next = prev + 1;
      localStorage.setItem(GAME_COUNT_KEY, String(next));
      // setTimeout 0: defer to avoid synchronous setState-in-effect
      if (next % AD_EVERY_N_GAMES === 0) setTimeout(() => setShowAd(true), 0);
    } catch {
      // localStorage not available
    }
  }, []);

  return { showAd, onAdClose: () => setShowAd(false) };
}

interface Props {
  onClose: () => void;
}

export function AdInterstitial({ onClose }: Props) {
  const [remaining, setRemaining] = useState(CLOSE_DELAY_SEC);
  const hasKakao = !!KAKAO_UNIT;
  const hasGoogle = !!(GOOGLE_CLIENT && GOOGLE_SLOT);

  useEffect(() => {
    if (remaining <= 0) return;
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-sm overflow-hidden rounded-2xl border-2 border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <span className="text-xs text-muted-foreground">광고</span>
          <button
            onClick={onClose}
            disabled={remaining > 0}
            className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-bold transition-opacity disabled:opacity-40"
          >
            {remaining > 0 ? (
              `${remaining}초 후 닫기`
            ) : (
              <>
                <X size={12} /> 닫기
              </>
            )}
          </button>
        </div>

        {/* Ad content — Google 우선, 없으면 Kakao */}
        <div className="flex flex-col items-center p-4">
          {hasGoogle ? (
            <div className="w-full">
              <GoogleAdBanner client={GOOGLE_CLIENT!} slot={GOOGLE_SLOT!} format="rectangle" />
            </div>
          ) : hasKakao ? (
            <div className="flex justify-center">
              <KakaoAdBanner unit={KAKAO_UNIT!} width={320} height={100} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
