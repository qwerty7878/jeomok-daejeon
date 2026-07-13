"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import { Check, Vote as VoteIcon } from "lucide-react";
import { TimerBar } from "@/components/ui/TimerBar";
import { ReactionBar } from "@/components/ui/ReactionBar";
import { cn } from "@/lib/utils";
import type { RoomState } from "@/types/game";

interface Props {
  state: RoomState;
  sessionId: string;
  onTick: () => void;
  mySubmissionId?: string | null;
}

export function VotingPhase({ state, sessionId, onTick, mySubmissionId }: Props) {
  const [voted, setVoted] = useState<string | null>(null);
  const [voting, setVoting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const tickSent = useRef(false);

  const voteProgress = (
    state as unknown as { _voteProgress?: { voted: number; total: number } }
  )._voteProgress;

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

  async function vote(submissionId: string) {
    if (voting || voted) return;
    setVoting(true);
    try {
      const res = await fetch(`/api/rooms/${state.room.code}/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId,
        },
        body: JSON.stringify({ round: state.room.round, submissionId }),
      });
      if (res.ok) {
        setVoted(submissionId);
        showToast("투표 완료!");
      } else {
        const data = (await res.json()) as { error: { code: string; message: string } };
        if (data.error?.code === "CANNOT_VOTE_SELF") {
          showToast("내 제목에는 투표할 수 없습니다");
        } else {
          showToast(data.error?.message ?? "투표 실패");
        }
      }
    } finally {
      setVoting(false);
    }
  }

  const submissions = state.submissions ?? [];
  const votedCount = voteProgress?.voted ?? 0;
  const totalVoters = voteProgress?.total ?? 0;
  const isSpectator = !state.me.alive;

  return (
    <div className="flex flex-1 flex-col gap-4">
      {toastMsg && (
        <div className="fixed right-4 top-20 z-50 gs-pop rounded-2xl border-2 border-secondary/30 bg-card px-4 py-3 text-sm font-bold text-secondary shadow-xl">
          {toastMsg}
        </div>
      )}

      {/* Header */}
      <div className="rounded-2xl border-2 border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="rounded-full bg-secondary px-3 py-1 font-display text-sm text-secondary-foreground">
            {state.room.round}라운드 · 투표
          </span>
          <span className="text-sm font-bold text-muted-foreground">
            {votedCount}/{totalVoters} 투표
          </span>
        </div>
        <TimerBar
          deadline={state.room.deadline}
          total={30}
          label="투표 시간"
          onExpire={handleExpire}
        />
      </div>

      {/* Thumbnail */}
      {state.image && (
        <div className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-3">
          <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-muted">
            <Image
              src={state.image.url}
              alt="이번 라운드 사진"
              fill
              className="object-cover"
              sizes="64px"
              unoptimized
            />
          </div>
          <div>
            <p className="font-display text-lg">가장 웃긴 제목에 투표!</p>
            <p className="text-sm text-muted-foreground">
              {isSpectator ? "관전자도 심사위원으로 투표할 수 있어요" : "자기 제목에는 투표할 수 없어요"}
            </p>
          </div>
        </div>
      )}

      {/* Submission cards */}
      {submissions.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          아무도 제출하지 않았습니다
        </div>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {submissions.map((sub) => {
            const isMine = mySubmissionId != null && sub.id === mySubmissionId;
            // 1v1(2명 이하)에선 자기 제목도 선택 가능
            const aliveCount = state.players.filter((p) => p.alive).length;
            const is1v1 = aliveCount <= 2;
            const chosen = voted === sub.id;
            const disabled = (!is1v1 && isMine) || voting || voted !== null;
            return (
              <button
                key={sub.id}
                disabled={disabled}
                onClick={() => vote(sub.id)}
                className={cn(
                  "group relative flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition",
                  chosen
                    ? "border-primary bg-primary/10"
                    : (!is1v1 && isMine)
                    ? "cursor-not-allowed border-dashed border-border bg-muted/40"
                    : voted !== null
                    ? "border-border bg-card opacity-60"
                    : "border-border bg-card hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
                )}
              >
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-full border-2 transition",
                    chosen
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground"
                  )}
                >
                  {chosen ? <Check size={18} /> : <VoteIcon size={16} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-lg leading-snug text-balance">
                    &ldquo;{sub.title}&rdquo;
                  </span>
                  {isMine && (
                    <span className="text-xs font-bold text-muted-foreground">내가 쓴 제목</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {(voted || isSpectator) && (
        <div className="rounded-2xl border-2 border-dashed border-border bg-card/50 p-4">
          {voted && (
            <p className="mb-3 text-center text-sm font-bold text-muted-foreground">
              투표 완료! 다른 참가자를 기다리는 중...
            </p>
          )}
          <ReactionBar roomCode={state.room.code} sessionId={sessionId} compact />
        </div>
      )}
    </div>
  );
}
