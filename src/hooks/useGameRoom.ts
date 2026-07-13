"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { RoomState, Phase } from "@/types/game";

export interface ChatMessage {
  nickname: string;
  message: string;
  at: string;
  alive?: boolean;
}

export interface Reaction {
  id: string;
  nickname: string;
  emoji: string;
}

export function useGameRoom(code: string, sessionId: string, playerId: string) {
  const [state, setState] = useState<RoomState | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [connected, setConnected] = useState(true);
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabaseClient>["channel"]> | null>(null);
  const codeRef = useRef(code);

  const fetchState = useCallback(async () => {
    if (!sessionId) return;
    const res = await fetch(`/api/rooms/${code}/state`, {
      headers: { "x-session-id": sessionId },
    });
    if (res.ok) {
      const data = await res.json();
      setState(data);
    }
  }, [code, sessionId]);

  useEffect(() => {
    if (!sessionId || !code) return;

    const supabase = getSupabaseClient();
    const channel = supabase.channel(`room:${code}`, {
      config: { broadcast: { ack: false } },
    });
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "PHASE_CHANGED" }, ({ payload }) => {
        setState((prev) => {
          if (!prev) return prev;
          const isNewWriting = payload.phase === "WRITING";
          const isRoundResult = payload.phase === "ROUND_RESULT";
          return {
            ...prev,
            room: {
              ...prev.room,
              phase: payload.phase as Phase,
              round: payload.round,
              deadline: payload.deadline,
            },
            // WRITING 시작 시 제출/투표 상태 초기화
            ...(isNewWriting
              ? {
                  me: { ...prev.me, submitted: false, voted: false },
                  _submitProgress: { submitted: 0, total: 0, playerIds: [] },
                  _submittedPlayerIds: [],
                  _votedPlayerIds: [],
                  submissions: [],
                }
              : {}),
            // ROUND_RESULT 진입 시 스킵 동의 초기화
            ...(isRoundResult ? { _skipReadyIds: [] } : {}),
          } as unknown as typeof prev;
        });
      })
      .on("broadcast", { event: "IMAGE_REVEALED" }, ({ payload }) => {
        // 이미지 프리로드 — 브라우저가 미리 다운로드 시작하여 렌더 시 딜레이 감소
        if (typeof window !== "undefined" && payload.imageUrl) {
          const img = new window.Image();
          img.src = payload.imageUrl;
        }
        setState((prev) => {
          if (!prev) return prev;
          return { ...prev, image: { url: payload.imageUrl } };
        });
      })
      .on("broadcast", { event: "PLAYER_UPDATE" }, ({ payload }) => {
        setState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            players: payload.players.map((p: RoomState["players"][0]) => ({
              ...p,
              isHost: p.id === prev.room.hostId,
            })),
          };
        });
      })
      .on("broadcast", { event: "HOST_CHANGED" }, ({ payload }) => {
        setState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            room: { ...prev.room, hostId: payload.newHostId },
            players: prev.players.map((p) => ({
              ...p,
              isHost: p.id === payload.newHostId,
            })),
          };
        });
      })
      .on("broadcast", { event: "SUBMIT_PROGRESS" }, ({ payload }) => {
        setState((prev) => {
          if (!prev) return prev;
          const iSubmitted = (payload.playerIds as string[] | undefined ?? []).includes(playerId);
          return {
            ...prev,
            _submitProgress: payload,
            _submittedPlayerIds: payload.playerIds ?? [],
            me: iSubmitted ? { ...prev.me, submitted: true } : prev.me,
          } as unknown as RoomState;
        });
      })
      .on("broadcast", { event: "SUBMISSIONS_REVEALED" }, ({ payload }) => {
        setState((prev) => {
          if (!prev) return prev;
          return { ...prev, submissions: payload.submissions };
        });
      })
      .on("broadcast", { event: "VOTE_PROGRESS" }, ({ payload }) => {
        setState((prev) => {
          if (!prev) return prev;
          const iVoted = (payload.voterIds as string[] | undefined ?? []).includes(playerId);
          return {
            ...prev,
            _voteProgress: payload,
            _votedPlayerIds: payload.voterIds ?? [],
            me: iVoted ? { ...prev.me, voted: true } : prev.me,
          } as unknown as RoomState;
        });
      })
      .on("broadcast", { event: "SKIP_READY" }, ({ payload }) => {
        setState((prev) => {
          if (!prev) return prev;
          const current = (prev as unknown as { _skipReadyIds?: string[] })._skipReadyIds ?? [];
          if (current.includes(payload.playerId as string)) return prev;
          return {
            ...prev,
            _skipReadyIds: [...current, payload.playerId],
          } as unknown as RoomState;
        });
      })
      .on("broadcast", { event: "ROUND_RESULT" }, ({ payload }) => {
        setState((prev) => {
          if (!prev) return prev;
          const updatedPlayers = prev.players.map((p) => ({
            ...p,
            lives: (payload.lives as Record<string, number>)[p.id] ?? p.lives,
            alive: ((payload.lives as Record<string, number>)[p.id] ?? p.lives) > 0,
          }));
          const myNewAlive = updatedPlayers.find((p) => p.id === playerId)?.alive ?? prev.me.alive;
          return {
            ...prev,
            result: { ranking: payload.ranking, eliminated: payload.eliminated, losers: payload.losers ?? [] },
            players: updatedPlayers,
            me: { ...prev.me, alive: myNewAlive },
          };
        });
      })
      .on("broadcast", { event: "REACTION" }, ({ payload }) => {
        setReactions((prev) => [
          ...prev.slice(-9),
          { id: `${Date.now()}-${Math.random()}`, nickname: payload.nickname as string, emoji: payload.emoji as string },
        ]);
      })
      .on("broadcast", { event: "GAME_OVER" }, ({ payload }) => {
        setState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            room: { ...prev.room, phase: "GAME_OVER" },
            _gameOver: payload,
          } as unknown as RoomState;
        });
      })
      .on("broadcast", { event: "SETTINGS_CHANGED" }, ({ payload }) => {
        setState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            room: {
              ...prev.room,
              ...(payload.lives !== undefined ? { lives: payload.lives as number } : {}),
              ...(payload.max_players !== undefined ? { maxPlayers: payload.max_players as number } : {}),
              ...(payload.write_sec !== undefined ? { writeSec: payload.write_sec as number } : {}),
            },
          };
        });
      })
      .on("broadcast", { event: "ROOM_CLOSED" }, () => {
        // 방 삭제 — 로비로 리다이렉트
        if (typeof window !== "undefined") window.location.href = "/";
      })
      .on("broadcast", { event: "CHAT" }, ({ payload }) => {
        setChat((prev) => [...prev.slice(-49), payload as ChatMessage]);
      })
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        // 최고참 1명만 sync 호출
        if (!leftPresences || leftPresences.length === 0) return;
        const left = leftPresences[0] as unknown as { sessionId: string };
        fetch(`/api/rooms/${codeRef.current}/sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-session-id": sessionId,
          },
          body: JSON.stringify({ leftSessionId: left.sessionId }),
        });
      })
      .subscribe(async (status) => {
        setConnected(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED") {
          await channel.track({ sessionId, playerId });
          await fetchState(); // 재연결 시 동기화
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [code, sessionId, playerId, fetchState]);

  return { state, chat, reactions, connected, refetch: fetchState };
}
