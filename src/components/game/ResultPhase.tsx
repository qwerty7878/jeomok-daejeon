"use client";
import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import { Trophy, Crown, HeartCrack, AlertTriangle, ArrowRight, Check, Bot } from "lucide-react";
import { TimerBar } from "@/components/ui/TimerBar";
import { Hearts } from "@/components/ui/Hearts";
import { GameButton } from "@/components/ui/GameButton";
import { cn } from "@/lib/utils";
import type { RoomState } from "@/types/game";

function useReveal(total: number, lowestIdx: number) {
  const [revealed, setRevealed] = useState(0);
  useEffect(() => {
    if (total === 0) return;
    const t0 = setTimeout(() => { setRevealed(0); }, 0);
    let t: ReturnType<typeof setTimeout>;
    const reveal = (i: number) => {
      if (i >= total) return;
      const delay = i === lowestIdx ? 700 : 300;
      t = setTimeout(() => {
        setRevealed(i + 1);
        reveal(i + 1);
      }, delay);
    };
    const tStart = setTimeout(() => reveal(0), 100);
    return () => { clearTimeout(t0); clearTimeout(t); clearTimeout(tStart); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);
  return revealed;
}

interface Props {
  state: RoomState;
  sessionId: string;
  onTick: () => void;
  onForceTick: () => void;
  skipReadyIds: string[];
}

export function ResultPhase({ state, sessionId, onTick, onForceTick, skipReadyIds }: Props) {
  const tickSent = useRef(false);
  const skipSent = useRef(false);
  const [skipping, setSkipping] = useState(false);

  const aliveCount = state.players.filter((p) => p.alive && !p.nickname.startsWith("봇")).length;
  const myPlayerId = state.me.playerId;
  const iMeReady = skipReadyIds.includes(myPlayerId);

  useEffect(() => {
    if (aliveCount > 0 && skipReadyIds.length >= aliveCount && !skipSent.current) {
      skipSent.current = true;
      onForceTick();
    }
  }, [skipReadyIds, aliveCount, onForceTick]);

  function handleExpire() {
    if (!tickSent.current) {
      tickSent.current = true;
      onTick();
    }
  }

  async function signalReady() {
    if (iMeReady || skipping) return;
    setSkipping(true);
    await fetch(`/api/rooms/${state.room.code}/skip`, {
      method: "POST",
      headers: { "x-session-id": sessionId },
    });
    setSkipping(false);
  }

  const result = state.result;

  const rankingLen = result?.ranking.length ?? 0;
  const lowestIdx = rankingLen > 0 ? rankingLen - 1 : 0;
  const revealed = useReveal(rankingLen, lowestIdx);

  if (!result) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        결과 계산 중...
      </div>
    );
  }

  // Ranking is already sorted by finalScore desc from server
  const winner = result.ranking[0]?.votes > 0 || (result.ranking[0]?.aiScore ?? 0) > 50
    ? result.ranking[0]
    : null;
  // All tied = no clear loser (everyone has same finalScore)
  const noLosers = !result.losers || result.losers.length === 0;

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Timer + skip */}
      <div className="rounded-2xl border-2 border-border bg-card p-4">
        <TimerBar
          deadline={state.room.deadline}
          total={15}
          label={`${state.room.round}라운드 결과`}
          onExpire={handleExpire}
        />
        <div className="mt-3 flex items-center gap-3">
          <GameButton
            onClick={signalReady}
            disabled={iMeReady || skipping}
            variant={iMeReady ? "secondary" : "outline"}
            size="sm"
            className="shrink-0"
          >
            {iMeReady ? <Check size={14} /> : <ArrowRight size={14} />}
            {iMeReady ? "준비 완료" : "다음으로"}
          </GameButton>
          <div className="flex flex-1 items-center gap-1.5">
            {state.players.filter((p) => p.alive && !p.nickname.startsWith("봇")).map((p) => (
              <span
                key={p.id}
                className={cn(
                  "h-2 w-2 rounded-full transition-colors",
                  skipReadyIds.includes(p.id) ? "bg-secondary" : "bg-muted-foreground/30"
                )}
                title={p.nickname}
              />
            ))}
            <span className="text-xs text-muted-foreground">
              {skipReadyIds.length}/{aliveCount} 동의
            </span>
          </div>
        </div>
      </div>

      {/* No-loser round */}
      {noLosers && result.ranking.length > 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-accent bg-accent/15 p-8 text-center">
          <AlertTriangle size={40} className="text-accent-foreground" />
          <p className="font-display text-xl">무효 라운드</p>
          <p className="text-sm text-muted-foreground">
            유효한 투표가 없어 아무도 목숨을 잃지 않았어요.
          </p>
        </div>
      ) : winner ? (
        <div className="gs-pop overflow-hidden rounded-2xl border-2 border-accent bg-card">
          <div className="flex items-center gap-2 bg-accent px-4 py-2 font-display text-accent-foreground">
            <Trophy size={18} /> 이번 라운드 베스트 제목
          </div>
          <div className="flex items-center gap-4 p-5">
            {state.image && (
              <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-muted">
                <Image
                  src={state.image.url}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              </div>
            )}
            <div className="min-w-0">
              <p className="font-display text-2xl leading-snug text-balance">
                &ldquo;{winner.title}&rdquo;
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-muted-foreground">
                <Crown size={15} className="fill-accent text-accent-foreground/70" />
                {winner.author} · {winner.votes}표
                <span className="flex items-center gap-0.5 text-xs font-normal text-muted-foreground/70">
                  <Bot size={11} /> AI {winner.aiScore}
                </span>
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Full ranking */}
      <div className="rounded-2xl border-2 border-border bg-card p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <h3 className="font-display text-base text-muted-foreground">전체 순위</h3>
          <span className="flex items-center gap-1 text-xs text-muted-foreground/60">
            유저 70% <span className="mx-1">·</span> <Bot size={10} /> AI 30%
          </span>
        </div>
        <ul className="space-y-1.5">
          {result.ranking.map((r, i) => {
            const isLoser = result.losers?.includes(r.id) ?? false;
            const isMe = r.id === myPlayerId;
            const player = state.players.find((p) => p.id === r.id);
            const eliminated = result.eliminated.includes(r.id);
            const isVisible = i < revealed;

            return (
              <li
                key={r.id}
                className={cn(
                  "flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 transition-all duration-300",
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none",
                  isLoser && isVisible
                    ? "border-primary/40 bg-primary/5"
                    : "border-transparent bg-background",
                  isMe && isVisible && "ring-2 ring-secondary/40"
                )}
              >
                <span className="w-6 text-center font-display text-lg text-muted-foreground">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-base leading-tight">
                    &ldquo;{r.title}&rdquo;
                  </p>
                  <p className="text-xs font-bold text-muted-foreground">{r.author}</p>
                </div>
                {/* Votes + AI score */}
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-sm font-bold tabular-nums">
                    {r.votes}표
                  </span>
                  <span className="flex items-center gap-0.5 rounded-full bg-muted/60 px-2 py-0.5 text-xs font-bold tabular-nums text-muted-foreground">
                    <Bot size={10} />{r.aiScore}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {isLoser && (
                    <HeartCrack size={16} className="gs-heartbreak text-primary" />
                  )}
                  {player && (
                    <Hearts
                      lives={player.lives}
                      max={state.room.lives}
                      size={13}
                      breaking={isLoser}
                    />
                  )}
                </div>
                {eliminated && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
                    탈락
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
