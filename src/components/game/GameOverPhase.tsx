"use client";
import { useState } from "react";
import Link from "next/link";
import { Trophy, Crown, RotateCcw, LogOut, Heart, Share2 } from "lucide-react";
import { GameButton } from "@/components/ui/GameButton";
import { cn } from "@/lib/utils";
import type { RoomState } from "@/types/game";
import { AdInterstitial, useGameEndAd } from "@/components/ads/AdInterstitial";

interface Props {
  state: RoomState;
  sessionId: string;
  gameOver: { winners: string[]; resultId: string | null };
}

export function GameOverPhase({ state, sessionId, gameOver }: Props) {
  const [rematching, setRematching] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const { showAd, onAdClose } = useGameEndAd();

  const isHost =
    state.players.find((p) => p.id === state.me.playerId)?.isHost ?? false;

  const winnerNicknames = gameOver.winners
    .map((wId) => state.players.find((p) => p.id === wId)?.nickname ?? wId)
    .filter(Boolean);

  const iWon = gameOver.winners.includes(state.me.playerId);

  const ranking = [...state.players]
    .filter((p) => p.alive || !p.alive)
    .sort((a, b) => {
      if (a.alive !== b.alive) return a.alive ? -1 : 1;
      return b.lives - a.lives;
    });

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2000);
  }

  function getResultUrl() {
    return gameOver.resultId ? `${location.origin}/api/og/result/${gameOver.resultId}` : location.href;
  }

  async function shareResult() {
    const url = getResultUrl();
    if (navigator.share) {
      await navigator.share({ title: "제목대전 결과", url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url);
      showToast("결과 링크 복사됨");
    }
  }

  async function rematch() {
    setRematching(true);
    try {
      const res = await fetch(`/api/rooms/${state.room.code}/rematch`, {
        method: "POST",
        headers: { "x-session-id": sessionId },
      });
      if (!res.ok) {
        const data = (await res.json()) as { error: { message: string } };
        showToast(data.error?.message ?? "재시작 실패");
      }
    } finally {
      setRematching(false);
    }
  }

  return (
    <div className="relative flex flex-1 flex-col items-center gap-6 py-6">
      {showAd && <AdInterstitial onClose={onAdClose} />}
      {toastMsg && (
        <div className="fixed right-4 top-20 z-50 gs-pop rounded-2xl border-2 border-secondary/30 bg-card px-4 py-3 text-sm font-bold text-secondary shadow-xl">
          {toastMsg}
        </div>
      )}

      {/* Winner banner */}
      <div className="gs-pop flex flex-col items-center text-center">
        <div className="mb-2 flex size-16 items-center justify-center rounded-full bg-accent">
          <Trophy size={34} className="text-accent-foreground" />
        </div>
        <h1 className="font-display text-3xl">게임 종료!</h1>
        <p className="text-muted-foreground">
          {winnerNicknames.length > 1
            ? "공동 우승자가 탄생했어요"
            : "최후의 1인이 결정됐어요"}
        </p>
      </div>

      {/* Winners */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {winnerNicknames.map((name) => (
          <div
            key={name}
            className={cn(
              "flex items-center gap-2 rounded-2xl border-2 px-5 py-3",
              iWon ? "border-primary bg-primary/10" : "border-accent bg-accent/15"
            )}
          >
            <Crown
              size={22}
              className="fill-accent text-accent-foreground/80"
            />
            <span className="font-display text-xl">{name}</span>
          </div>
        ))}
      </div>

      {/* Final ranking */}
      <div className="w-full max-w-md">
        <h2 className="mb-3 flex items-center justify-center gap-1.5 font-display text-xl">
          <Trophy size={18} className="text-accent-foreground" /> 최종 순위
        </h2>
        <ol className="overflow-hidden rounded-2xl border-2 border-border bg-card">
          {ranking.map((p, i) => {
            const rank = i + 1;
            const isMe = p.id === state.me.playerId;
            return (
              <li
                key={p.id}
                className={cn(
                  "flex items-center gap-3 border-b border-border/60 px-4 py-3 last:border-0",
                  isMe && "bg-primary/10"
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full font-display text-base",
                    rank === 1
                      ? "bg-accent text-accent-foreground"
                      : rank === 2
                      ? "bg-secondary text-secondary-foreground"
                      : rank === 3
                      ? "bg-primary/80 text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {rank}
                </span>
                <span className="flex min-w-0 flex-1 items-center gap-1.5 font-bold">
                  {rank === 1 && (
                    <Crown
                      size={16}
                      className="shrink-0 fill-accent text-accent-foreground/80"
                    />
                  )}
                  <span className="truncate">{p.nickname}</span>
                  {isMe && (
                    <span className="shrink-0 text-xs font-bold text-primary">나</span>
                  )}
                  {!p.alive && (
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                      탈락
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
                  <Heart
                    size={13}
                    className={p.lives > 0 ? "fill-primary text-primary" : ""}
                  />
                  {p.lives}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 sm:flex-row">
        {isHost && (
          <GameButton
            onClick={rematch}
            disabled={rematching}
            size="lg"
            className="font-serif"
          >
            <RotateCcw size={20} />
            {rematching ? "준비 중..." : "다시 하기"}
          </GameButton>
        )}
        <GameButton onClick={shareResult} variant="secondary" size="lg" className="font-serif">
          <Share2 size={18} /> 결과 공유
        </GameButton>
        <Link href="/">
          <GameButton variant="outline" size="lg" className="font-serif">
            <LogOut size={20} /> 나가기
          </GameButton>
        </Link>
      </div>
      {!isHost && (
        <p className="text-sm text-muted-foreground">
          방장이 다시 시작하면 대기실로 이동해요
        </p>
      )}
    </div>
  );
}
