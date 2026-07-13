"use client";
import { Crown, Check, Bot } from "lucide-react";
import { Hearts } from "@/components/ui/Hearts";
import { cn } from "@/lib/utils";
import type { Player } from "@/types/game";

interface Props {
  players: Player[];
  myPlayerId: string;
  phase?: string;
  maxLives?: number;
  submittedIds?: Set<string>;
  votedIds?: Set<string>;
}

export function PlayerList({
  players,
  myPlayerId,
  maxLives = 3,
  submittedIds,
  votedIds,
}: Props) {
  const sorted = [...players].sort((a, b) => {
    if (a.alive !== b.alive) return a.alive ? -1 : 1;
    return 0;
  });
  const activeCount = players.filter((p) => p.alive).length;
  const total = players.length;

  return (
    <div className="flex h-full flex-col rounded-2xl border-2 border-border bg-card">
      <div className="flex items-center justify-between border-b-2 border-border px-4 py-3">
        <h2 className="font-display text-lg">참가자</h2>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-sm font-bold text-muted-foreground">
          {activeCount}/{total}
        </span>
      </div>
      <ul className="flex-1 space-y-1.5 overflow-y-auto p-3">
        {sorted.map((p) => {
          const isMe = p.id === myPlayerId;
          const submitted = submittedIds?.has(p.id);
          const voted = votedIds?.has(p.id);
          return (
            <li
              key={p.id}
              className={cn(
                "flex items-center gap-2 rounded-xl border-2 px-3 py-2 transition",
                !p.alive
                  ? "border-transparent bg-muted/50 opacity-60"
                  : "border-border bg-background",
                isMe && "border-primary/60 bg-primary/5"
              )}
            >
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                {p.isHost && (
                  <Crown size={15} className="shrink-0 fill-accent text-accent-foreground/70" />
                )}
                {p.nickname.startsWith("봇") && (
                  <Bot size={13} className="shrink-0 text-muted-foreground" />
                )}
                <span className="truncate text-sm font-bold">{p.nickname}</span>
                {isMe && (
                  <span className="shrink-0 text-xs font-bold text-primary">나</span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {submitted && (
                  <Check size={14} className="text-secondary" aria-label="제출 완료" />
                )}
                {voted && (
                  <Check size={14} className="text-accent-foreground" aria-label="투표 완료" />
                )}
                {!p.alive ? (
                  <span className="text-xs font-bold text-muted-foreground">탈락</span>
                ) : (
                  <Hearts lives={p.lives} max={maxLives} size={12} />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
