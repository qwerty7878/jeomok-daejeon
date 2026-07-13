"use client";
import { useEffect, useState } from "react";
import type { Reaction } from "@/hooks/useGameRoom";

interface ActiveReaction extends Reaction {
  x: number;
}

export function ReactionOverlay({ reactions }: { reactions: Reaction[] }) {
  const [active, setActive] = useState<ActiveReaction[]>([]);

  useEffect(() => {
    if (reactions.length === 0) return;
    const latest = reactions[reactions.length - 1];
    const item: ActiveReaction = { ...latest, x: 20 + Math.random() * 60 };
    const t0 = setTimeout(() => {
      setActive((prev) => [...prev.slice(-8), item]);
    }, 0);
    const t = setTimeout(() => {
      setActive((prev) => prev.filter((r) => r.id !== item.id));
    }, 2500);
    return () => { clearTimeout(t0); clearTimeout(t); };
  }, [reactions]);

  if (active.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {active.map((r) => (
        <div
          key={r.id}
          className="gs-float-up absolute bottom-20 flex flex-col items-center gap-0.5"
          style={{ left: `${r.x}%` }}
        >
          <span className="text-3xl drop-shadow">{r.emoji}</span>
          <span className="rounded-full bg-card/80 px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground backdrop-blur-sm">
            {r.nickname}
          </span>
        </div>
      ))}
    </div>
  );
}
