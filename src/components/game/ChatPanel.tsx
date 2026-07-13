"use client";
import { useEffect, useRef, useState } from "react";
import { Send, Lock, Flag } from "lucide-react";
import type { ChatMessage } from "@/hooks/useGameRoom";

interface Props {
  messages: ChatMessage[];
  sessionId: string;
  roomCode: string;
  phase: string;
  myAlive: boolean;
  mySubmitted: boolean;
}

export function ChatPanel({
  messages,
  sessionId,
  roomCode,
  phase,
  myAlive,
  mySubmitted,
}: Props) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [reportedMsgs, setReportedMsgs] = useState<Set<number>>(new Set());
  const composing = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const isLocked =
    phase === "VOTING" || (phase === "WRITING" && myAlive && !mySubmitted);

  const lockReason =
    phase === "VOTING"
      ? "투표 중에는 채팅이 잠깁니다"
      : "제출 후 채팅 가능";

  async function reportMessage(idx: number, msg: ChatMessage) {
    if (reportedMsgs.has(idx)) return;
    await fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-session-id": sessionId },
      body: JSON.stringify({
        roomCode,
        targetType: "chat",
        targetContent: msg.message,
        context: msg.nickname,
      }),
    });
    setReportedMsgs((prev) => new Set([...prev, idx]));
  }

  async function send() {
    if (!input.trim() || sending || isLocked) return;
    setSending(true);
    try {
      await fetch(`/api/rooms/${roomCode}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId,
        },
        body: JSON.stringify({ message: input.trim() }),
      });
      setInput("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border-2 border-border bg-card">
      <div className="border-b border-border px-3 py-2">
        <h2 className="font-display text-base">채팅</h2>
      </div>
      <div className="flex-1 space-y-1.5 overflow-y-auto p-2.5">
        {messages.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            아직 대화가 없어요
          </p>
        )}
        {messages.map((m, i) => {
          const isSpectator = m.alive === false;
          const reported = reportedMsgs.has(i);
          return (
            <div key={i} className="group relative text-sm leading-relaxed">
              {isSpectator && (
                <span className="mr-1 rounded px-1 py-px text-[10px] font-bold bg-muted text-muted-foreground align-middle">관전</span>
              )}
              <span className={isSpectator ? "font-bold text-muted-foreground" : "font-bold text-secondary"}>
                {m.nickname}
              </span>
              <span className="mx-1 text-muted-foreground/50">:</span>
              <span className={`break-words ${isSpectator ? "text-muted-foreground" : "text-foreground"}`}>{m.message}</span>
              <button
                onClick={() => reportMessage(i, m)}
                disabled={reported}
                className="ml-1 inline-flex items-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30"
                aria-label="신고"
                title={reported ? "신고됨" : "신고하기"}
              >
                <Flag size={10} className={reported ? "text-destructive" : "text-muted-foreground hover:text-destructive"} />
              </button>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="border-t border-border p-2">
        {isLocked ? (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-muted px-3 py-2.5 text-sm font-bold text-muted-foreground">
            <Lock size={15} />
            {lockReason}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onCompositionStart={() => (composing.current = true)}
              onCompositionEnd={() => (composing.current = false)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.nativeEvent.isComposing &&
                  e.keyCode !== 229 &&
                  !composing.current
                ) {
                  e.preventDefault();
                  send();
                }
              }}
              maxLength={100}
              placeholder="메시지 입력..."
              className="min-w-0 flex-1 rounded-xl border-2 border-input bg-background px-3 py-2 text-sm outline-none focus:border-secondary"
            />
            <button
              onClick={send}
              disabled={sending || !input.trim()}
              className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground transition hover:opacity-90 disabled:opacity-40"
              aria-label="전송"
            >
              <Send size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
