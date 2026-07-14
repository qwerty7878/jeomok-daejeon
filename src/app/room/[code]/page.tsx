"use client";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { LogOut, Dices } from "lucide-react";
import { useSession } from "@/hooks/useSession";
import { useGameRoom } from "@/hooks/useGameRoom";
import { PlayerList } from "@/components/game/PlayerList";
import { ChatPanel } from "@/components/game/ChatPanel";
import { WritingPhase } from "@/components/game/WritingPhase";
import { VotingPhase } from "@/components/game/VotingPhase";
import { ResultPhase } from "@/components/game/ResultPhase";
import { WaitingPhase } from "@/components/game/WaitingPhase";
import { GameOverPhase } from "@/components/game/GameOverPhase";
import { GameButton } from "@/components/ui/GameButton";
import { Modal } from "@/components/ui/Modal";
import { ReactionOverlay } from "@/components/ui/ReactionOverlay";
import { cn } from "@/lib/utils";
import { AdBanner } from "@/components/ads/AdBanner";
import { AdColumn } from "@/components/ads/AdColumn";
import type { RoomState } from "@/types/game";

function JoinModal({
  code,
  sessionId,
  nickname: savedNickname,
  initialError = "",
  onJoined,
}: {
  code: string;
  sessionId: string;
  nickname: string;
  initialError?: string;
  onJoined: (playerId: string) => void;
}) {
  const [nickname, setNickname] = useState(savedNickname);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState(initialError);

  const RANDOM = ["감자도리", "허수아비", "눈깔사탕", "묻지마사나이", "떡갈비맨"];
  function randomPick() {
    setNickname(RANDOM[Math.floor(Math.random() * RANDOM.length)]);
    setError("");
  }

  async function join() {
    if (!nickname.trim() || joining) return;
    if (nickname.trim().length < 2) {
      setError("2자 이상 입력해주세요");
      return;
    }
    setJoining(true);
    try {
      const inviteToken =
        new URLSearchParams(window.location.search).get("t") ?? "";
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId,
        },
        body: JSON.stringify({
          nickname: nickname.trim(),
          inviteToken: inviteToken || undefined,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { playerId: string };
        localStorage.setItem("nickname", nickname.trim());
        onJoined(data.playerId);
      } else {
        const data = (await res.json()) as { error: { message: string } };
        setError(data.error?.message ?? "입장 실패");
      }
    } finally {
      setJoining(false);
    }
  }

  return (
    <Modal open dismissable={false} hideClose title="방 입장">
      <p className="mb-4 text-sm text-muted-foreground">
        게임에서 쓸 닉네임을 정해주세요.
      </p>
      <div className="flex gap-2">
        <input
          className="h-12 flex-1 rounded-2xl border-2 border-input bg-background px-4 text-base outline-none focus:border-primary"
          value={nickname}
          onChange={(e) => {
            setNickname(e.target.value.slice(0, 8));
            setError("");
          }}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.nativeEvent.isComposing &&
              e.keyCode !== 229
            )
              join();
          }}
          placeholder="닉네임 (2~8자)"
          maxLength={8}
          autoFocus
        />
        <button
          type="button"
          onClick={randomPick}
          className="grid size-12 shrink-0 place-items-center rounded-2xl border-2 border-input text-muted-foreground hover:border-primary hover:text-primary"
          aria-label="랜덤 닉네임"
        >
          <Dices className="size-5" />
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      <GameButton
        onClick={join}
        disabled={nickname.trim().length < 2 || joining}
        size="lg"
        className="mt-4 w-full font-serif"
      >
        {joining ? "입장 중..." : "입장"}
      </GameButton>
    </Modal>
  );
}

export default function RoomPage() {
  const params = useParams();
  const code = (params.code as string).toUpperCase();
  const { sessionId, nickname } = useSession();

  const [playerId, setPlayerId] = useState<string>("");
  const [joined, setJoined] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const autoJoinRef = useRef(false);
  // submissionInfo stores the submitted round + submissionId so VotingPhase can identify own card
  const [submissionInfo, setSubmissionInfo] = useState<{ round: number; id: string } | null>(null);

  // Auto-join if nickname is already saved — no modal needed
  useEffect(() => {
    if (!nickname || !sessionId || joined || autoJoinRef.current) return;
    autoJoinRef.current = true;
    const inviteToken =
      typeof window !== "undefined"
        ? (new URLSearchParams(window.location.search).get("t") ?? "")
        : "";
    fetch(`/api/rooms/${code}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-session-id": sessionId },
      body: JSON.stringify({ nickname, inviteToken: inviteToken || undefined }),
    }).then(async (res) => {
      if (res.ok) {
        const data = (await res.json()) as { playerId: string };
        setPlayerId(data.playerId);
        setJoined(true);
      } else {
        const data = (await res.json()) as { error: { message: string } };
        setJoinError(data.error?.message ?? "입장 실패");
        autoJoinRef.current = false; // allow retry via modal
      }
    });
  }, [nickname, sessionId, joined, code]);

  const { state, chat, reactions, connected } = useGameRoom(
    code,
    joined ? sessionId : "",
    playerId
  );

  const sendTick = useCallback(async (force?: boolean) => {
    if (!state || !sessionId) return;
    await fetch(`/api/rooms/${code}/tick`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-id": sessionId,
      },
      body: JSON.stringify({
        phase: state.room.phase,
        round: state.room.round,
        ...(force ? { force: true } : {}),
      }),
    });
  }, [code, sessionId, state]);

  const sendForceTick = useCallback(() => sendTick(true), [sendTick]);

  function handleJoined(pid: string) {
    setPlayerId(pid);
    setJoined(true);
    setJoinError("");
  }

  function handleSubmitted(round: number, submissionId: string) {
    setSubmissionInfo({ round, id: submissionId });
  }

  // mySubmissionId is only valid for the current round
  const mySubmissionId =
    submissionInfo != null && submissionInfo.round === state?.room.round
      ? submissionInfo.id
      : null;

  const gameOver = useMemo(
    () =>
      (
        state as unknown as {
          _gameOver?: { winners: string[]; resultId: string | null };
        }
      )?._gameOver,
    [state]
  );

  if (!sessionId) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted-foreground">
        로딩 중...
      </div>
    );
  }

  // Show modal only when: no nickname (first visit) OR auto-join failed
  const needsJoinModal = !joined && (!nickname || joinError !== "");

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <ReactionOverlay reactions={reactions} />
      {leaveConfirm && (
        <Modal open dismissable={false} hideClose title="게임을 떠나시겠어요?">
          <p className="mb-5 text-sm text-muted-foreground">
            게임 진행 중입니다. 지금 나가면 탈락으로 처리될 수 있어요.
          </p>
          <div className="flex gap-2">
            <GameButton variant="outline" className="flex-1" onClick={() => setLeaveConfirm(false)}>
              계속 하기
            </GameButton>
            <Link href="/" className="flex-1">
              <GameButton className="w-full">
                <LogOut size={15} /> 나가기
              </GameButton>
            </Link>
          </div>
        </Modal>
      )}
      {needsJoinModal && (
        <JoinModal
          code={code}
          sessionId={sessionId}
          nickname={nickname}
          initialError={joinError}
          onJoined={handleJoined}
        />
      )}
      {/* Loading overlay while auto-joining */}
      {!joined && nickname && !joinError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="text-muted-foreground font-display text-lg">입장 중...</div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 border-b-2 border-foreground/10 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-2">
            {state && (
              <>
                <span className="font-display text-lg">{state.room.name}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs tracking-widest text-muted-foreground">
                  {state.room.code}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                connected ? "bg-secondary" : "bg-destructive"
              )}
            />
            {state && state.room.phase !== "WAITING" && state.room.phase !== "GAME_OVER" ? (
              <GameButton variant="outline" size="sm" onClick={() => setLeaveConfirm(true)}>
                <LogOut size={15} /> 나가기
              </GameButton>
            ) : (
              <Link href="/">
                <GameButton variant="outline" size="sm">
                  <LogOut size={15} /> 나가기
                </GameButton>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* 바깥 광고 컬럼 — fixed, 레이아웃 영향 없음 */}
      <div className="hidden 2xl:flex fixed left-0 top-14 h-[calc(100dvh-3.5rem)] w-40 flex-col items-center pt-4 px-2 pointer-events-none z-30">
        <div className="pointer-events-auto">
          <AdColumn />
        </div>
      </div>
      <div className="hidden 2xl:flex fixed right-0 top-14 h-[calc(100dvh-3.5rem)] w-40 flex-col items-center pt-4 px-2 pointer-events-none z-30">
        <div className="pointer-events-auto">
          <AdColumn />
        </div>
      </div>

      {/* Desktop 3-panel layout — 원래 너비 유지 */}
      <div className="hidden lg:flex flex-col h-[calc(100dvh-3.5rem)] overflow-hidden max-w-6xl mx-auto w-full">
        <div className="flex flex-1 gap-3 px-3 pt-3 overflow-hidden min-h-0">
          {/* 왼쪽 사이드바 — 참가자 */}
          <aside className="w-56 shrink-0 h-full overflow-hidden rounded-2xl border-2 border-border bg-card">
            {state ? (
              <PlayerList
                players={state.players}
                myPlayerId={state.me.playerId}
                phase={state.room.phase}
                maxLives={state.room.lives}
                roomCode={state.room.code}
                sessionId={sessionId}
                submittedIds={
                  (state as unknown as { _submittedPlayerIds?: string[] })._submittedPlayerIds
                    ? new Set((state as unknown as { _submittedPlayerIds: string[] })._submittedPlayerIds)
                    : undefined
                }
                votedIds={
                  (state as unknown as { _votedPlayerIds?: string[] })._votedPlayerIds
                    ? new Set((state as unknown as { _votedPlayerIds: string[] })._votedPlayerIds)
                    : undefined
                }
              />
            ) : (
              <div className="h-full" />
            )}
          </aside>

          {/* 게임 센터 */}
          <main className="flex flex-1 flex-col overflow-hidden min-w-0">
            <GameCenter
              state={state}
              sessionId={sessionId}
              sendTick={sendTick}
              sendForceTick={sendForceTick}
              gameOver={gameOver}
              mySubmissionId={mySubmissionId}
              onSubmitted={(id) => handleSubmitted(state?.room.round ?? 0, id)}
              skipReadyIds={(state as unknown as { _skipReadyIds?: string[] } | null)?._skipReadyIds ?? []}
            />
          </main>

          {/* 오른쪽 사이드바 — 채팅 */}
          <aside className="w-64 shrink-0 h-full overflow-hidden rounded-2xl border-2 border-border bg-card">
            <ChatPanel
              messages={chat}
              sessionId={sessionId}
              roomCode={state?.room.code ?? code}
              phase={state?.room.phase ?? "WAITING"}
              myAlive={state?.me.alive ?? true}
              mySubmitted={state?.me.submitted ?? false}
            />
          </aside>
        </div>

        {/* 하단 광고 띠 — 3패널 전체 너비로 연결 */}
        <div className="mx-3 mb-3">
          <AdBanner />
        </div>
      </div>

      {/* Mobile tab layout */}
      <MobileLayout
        state={state}
        sessionId={sessionId}
        chat={chat}
        sendTick={sendTick}
        sendForceTick={sendForceTick}
        gameOver={gameOver}
        code={code}
        mySubmissionId={mySubmissionId}
        onSubmitted={(id) => handleSubmitted(state?.room.round ?? 0, id)}
        skipReadyIds={(state as unknown as { _skipReadyIds?: string[] } | null)?._skipReadyIds ?? []}
      />
    </div>
  );
}

function GameCenter({
  state,
  sessionId,
  sendTick,
  sendForceTick,
  gameOver,
  mySubmissionId,
  onSubmitted,
  skipReadyIds,
}: {
  state: RoomState | null;
  sessionId: string;
  sendTick: () => void;
  sendForceTick: () => void;
  gameOver?: { winners: string[]; resultId: string | null };
  mySubmissionId?: string | null;
  onSubmitted?: (id: string) => void;
  skipReadyIds: string[];
}) {
  if (!state)
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        방 정보 로딩 중...
      </div>
    );

  if (state.room.phase === "WAITING")
    return <WaitingPhase state={state} sessionId={sessionId} inviteToken="" />;
  if (state.room.phase === "WRITING")
    return (
      <WritingPhase
        key={state.room.round}
        state={state}
        sessionId={sessionId}
        onTick={sendTick}
        onSubmitted={onSubmitted}
      />
    );
  if (state.room.phase === "VOTING")
    return (
      <VotingPhase
        state={state}
        sessionId={sessionId}
        onTick={sendTick}
        mySubmissionId={mySubmissionId}
      />
    );
  if (state.room.phase === "ROUND_RESULT")
    return (
      <ResultPhase
        state={state}
        sessionId={sessionId}
        onTick={sendTick}
        onForceTick={sendForceTick}
        skipReadyIds={skipReadyIds}
      />
    );
  if (state.room.phase === "GAME_OVER" && gameOver)
    return (
      <GameOverPhase state={state} sessionId={sessionId} gameOver={gameOver} />
    );
  return null;
}

function MobileLayout({
  state,
  sessionId,
  chat,
  sendTick,
  sendForceTick,
  gameOver,
  code,
  mySubmissionId,
  onSubmitted,
  skipReadyIds,
}: {
  state: RoomState | null;
  sessionId: string;
  chat: ReturnType<typeof useGameRoom>["chat"];
  sendTick: () => void;
  sendForceTick: () => void;
  gameOver?: { winners: string[]; resultId: string | null };
  code: string;
  mySubmissionId?: string | null;
  onSubmitted?: (id: string) => void;
  skipReadyIds: string[];
}) {
  const [tab, setTab] = useState<"game" | "chat" | "players">("game");
  const [lastReadLen, setLastReadLen] = useState(0);
  const unread =
    tab === "chat" ? 0 : Math.max(0, chat.length - lastReadLen);

  return (
    <div className="flex lg:hidden flex-1 flex-col">
      <div className="flex-1 overflow-hidden p-2">
        {tab === "game" && (
          <GameCenter
            state={state}
            sessionId={sessionId}
            sendTick={sendTick}
            sendForceTick={sendForceTick}
            gameOver={gameOver}
            mySubmissionId={mySubmissionId}
            onSubmitted={onSubmitted}
            skipReadyIds={skipReadyIds}
          />
        )}
        {tab === "chat" && (
          <ChatPanel
            messages={chat}
            sessionId={sessionId}
            roomCode={state?.room.code ?? code}
            phase={state?.room.phase ?? "WAITING"}
            myAlive={state?.me.alive ?? true}
            mySubmitted={state?.me.submitted ?? false}
          />
        )}
        {tab === "players" && state && (
          <PlayerList
            players={state.players}
            myPlayerId={state.me.playerId}
            phase={state.room.phase}
            maxLives={state.room.lives}
            roomCode={state.room.code}
            sessionId={sessionId}
            submittedIds={
              (state as unknown as { _submittedPlayerIds?: string[] })._submittedPlayerIds
                ? new Set((state as unknown as { _submittedPlayerIds: string[] })._submittedPlayerIds)
                : undefined
            }
            votedIds={
              (state as unknown as { _votedPlayerIds?: string[] })._votedPlayerIds
                ? new Set((state as unknown as { _votedPlayerIds: string[] })._votedPlayerIds)
                : undefined
            }
          />
        )}
      </div>

      <div className="shrink-0 overflow-hidden">
        <AdBanner />
      </div>
      <nav className="border-t-2 border-foreground/10 bg-card flex">
        {(["game", "chat", "players"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              if (t === "chat") setLastReadLen(chat.length);
            }}
            className={cn(
              "flex-1 py-2.5 text-xs font-bold relative transition-colors",
              tab === t
                ? "text-primary border-t-2 border-primary"
                : "text-muted-foreground"
            )}
          >
            {t === "game" ? "게임" : t === "chat" ? "채팅" : "참가자"}
            {t === "chat" && unread > 0 && (
              <span className="absolute right-1/4 top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
