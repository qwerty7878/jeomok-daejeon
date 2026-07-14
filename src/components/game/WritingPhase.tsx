"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import { Pencil, Check, Eye } from "lucide-react";
import { TimerBar } from "@/components/ui/TimerBar";
import { GameButton } from "@/components/ui/GameButton";
import { ReactionBar } from "@/components/ui/ReactionBar";
import type { RoomState } from "@/types/game";

const MAX = 40;

interface Props {
  state: RoomState;
  sessionId: string;
  onTick: () => void;
  onSubmitted?: (submissionId: string) => void;
}

export function WritingPhase({ state, sessionId, onTick, onSubmitted }: Props) {
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState(state.me.submitted);
  const [submitting, setSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const tickSent = useRef(false);
  const composing = useRef(false);

  const submitProgress = (
    state as unknown as {
      _submitProgress?: { submitted: number; total: number };
    }
  )._submitProgress;

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2000);
  }

  function handleExpire() {
    if (!tickSent.current) {
      tickSent.current = true;
      onTick();
    }
  }

  async function submit() {
    if (!text.trim() || submitting || !state.me.alive) return;
    // 낙관적 업데이트 — 클릭 즉시 제출 완료 표시
    setSubmitting(true);
    setSubmitted(true);
    try {
      const res = await fetch(`/api/rooms/${state.room.code}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId,
        },
        body: JSON.stringify({ round: state.room.round, title: text.trim() }),
      });
      if (res.ok) {
        const data = (await res.json()) as { submitted: boolean; submissionId: string | null };
        if (data.submissionId) onSubmitted?.(data.submissionId);
        showToast("제출 완료!");
      } else {
        const data = (await res.json()) as { error: { message: string } };
        setSubmitted(false); // 실패 시 되돌리기
        showToast(data.error?.message ?? "제출 실패");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const isSpectator = !state.me.alive;
  const activeCount = state.players.filter((p) => p.alive).length;
  const submittedCount = submitProgress?.submitted ?? 0;

  return (
    <div className="flex flex-1 flex-col gap-4">
      {toastMsg && (
        <div className="fixed right-4 top-20 z-50 gs-pop rounded-2xl border-2 border-secondary/30 bg-card px-4 py-3 text-sm font-bold text-secondary shadow-xl">
          {toastMsg}
        </div>
      )}

      {/* Round header + timer */}
      <div className="rounded-2xl border-2 border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="rounded-full bg-primary px-3 py-1 font-display text-sm text-primary-foreground">
            {state.room.round}라운드
          </span>
          <span className="text-sm font-bold text-muted-foreground">
            {submittedCount}/{activeCount} 제출
          </span>
        </div>
        <TimerBar
          deadline={state.room.deadline}
          total={state.room.writeSec}
          label="작성 시간"
          onExpire={handleExpire}
        />
      </div>

      {/* Image — unoptimized: 매 라운드 새 이미지라 Vercel 최적화 캐시가 항상 콜드라
          변환 지연이 그대로 체감 지연이 된다. useGameRoom의 IMAGE_REVEALED 프리로드와
          원본 URL을 맞추기 위해서도 필요 */}
      <div className="overflow-hidden rounded-2xl border-2 border-border bg-card">
        <div className="relative aspect-[4/3] w-full bg-muted">
          {state.image ? (
            <Image
              src={state.image.url}
              alt="이 사진에 어울리는 제목을 지어주세요"
              fill
              priority
              className="object-contain"
              sizes="(max-width: 1024px) 100vw, 640px"
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
              이미지 로딩 중...
            </div>
          )}
        </div>
      </div>

      {/* Input area */}
      {isSpectator ? (
        <div className="rounded-2xl border-2 border-dashed border-border bg-card/50 p-5">
          <p className="mb-4 flex items-center gap-2 font-bold text-muted-foreground">
            <Eye size={18} /> 관전 중 — 리액션을 보내보세요
          </p>
          <ReactionBar roomCode={state.room.code} sessionId={sessionId} />
        </div>
      ) : submitted ? (
        <div className="flex items-center gap-3 rounded-2xl border-2 border-secondary bg-secondary/10 p-5">
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground">
            <Check size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-muted-foreground">제출 완료</p>
            {text && (
              <p className="truncate font-display text-lg">&ldquo;{text}&rdquo;</p>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-border bg-card p-4">
          <label className="mb-2 flex items-center gap-1.5 font-display text-lg">
            <Pencil size={18} /> 제목을 지어주세요
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <input
                value={text}
                autoFocus
                onChange={(e) => setText(e.target.value.slice(0, MAX))}
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
                    submit();
                  }
                }}
                placeholder="예) 월요일 아침의 나"
                className="w-full rounded-xl border-2 border-input bg-background px-4 py-3 text-base outline-none focus:border-primary"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                {text.length}/{MAX}
              </span>
            </div>
            <GameButton
              onClick={submit}
              disabled={!text.trim() || submitting}
              size="lg"
              className="font-serif"
            >
              {submitting ? "제출 중..." : "제출"}
            </GameButton>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            미제출 시 자동으로 최저 득표 처리됩니다.
          </p>
        </div>
      )}
    </div>
  );
}
