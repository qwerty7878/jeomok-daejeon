"use client";
import { useCallback, useRef } from "react";

const EMOJIS = ["🤣", "👍", "🔥", "💀", "😭", "😮", "🥶"] as const;

interface Props {
  roomCode: string;
  sessionId: string;
  compact?: boolean;
}

export function ReactionBar({ roomCode, sessionId, compact = false }: Props) {
  const cooldownRef = useRef<Record<string, number>>({});

  const react = useCallback(async (emoji: string) => {
    const now = Date.now();
    if ((cooldownRef.current[emoji] ?? 0) > now) return;
    cooldownRef.current[emoji] = now + 1500;

    await fetch(`/api/rooms/${roomCode}/reaction`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-session-id": sessionId },
      body: JSON.stringify({ emoji }),
    });
  }, [roomCode, sessionId]);

  return (
    <div className={`flex flex-wrap gap-2 ${compact ? "" : "justify-center"}`}>
      {EMOJIS.map((e) => (
        <button
          key={e}
          onClick={() => react(e)}
          className={`${compact ? "h-9 w-9 text-lg" : "h-12 w-12 text-2xl"} rounded-2xl border-2 border-border bg-card transition active:scale-95 hover:border-primary hover:bg-primary/5`}
          aria-label={`${e} 리액션`}
        >
          {e}
        </button>
      ))}
    </div>
  );
}
