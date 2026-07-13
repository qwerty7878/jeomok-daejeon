"use client";
import { useSyncExternalStore, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";

// Module-level store so localStorage is only read once per page load
let _sessionId = "";
let _nickname = "";
const nickListeners = new Set<() => void>();

function getSessionIdSnapshot(): string {
  if (!_sessionId) {
    let sid = localStorage.getItem("sessionId");
    if (!sid) {
      sid = uuidv4();
      localStorage.setItem("sessionId", sid);
    }
    _sessionId = sid;
  }
  return _sessionId;
}

function getNicknameSnapshot(): string {
  if (!_nickname) {
    _nickname = localStorage.getItem("nickname") ?? "";
  }
  return _nickname;
}

function subscribeNickname(cb: () => void) {
  nickListeners.add(cb);
  return () => { nickListeners.delete(cb); };
}

export function useSession() {
  const sessionId = useSyncExternalStore(
    () => () => {},
    getSessionIdSnapshot,
    () => ""
  );

  const nickname = useSyncExternalStore(
    subscribeNickname,
    getNicknameSnapshot,
    () => ""
  );

  const saveNickname = useCallback((n: string) => {
    _nickname = n;
    localStorage.setItem("nickname", n);
    nickListeners.forEach((cb) => cb());
  }, []);

  return { sessionId, nickname, saveNickname };
}
