"use client";
import { useEffect, useRef, useState } from "react";

export function useCountdown(deadline: string | null, onExpire?: () => void) {
  // Use state for current time so render stays pure (no Date.now() in render)
  const [now, setNow] = useState(() => Date.now());
  const onExpireRef = useRef(onExpire);
  const firedRef = useRef(false);

  // Keep callback ref current — in effect, not during render
  useEffect(() => {
    onExpireRef.current = onExpire;
  });

  // Reset fired flag when deadline changes
  useEffect(() => {
    firedRef.current = false;
  }, [deadline]);

  // Tick every 500ms
  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => {
      setNow(Date.now());
    }, 500);
    return () => clearInterval(id);
  }, [deadline]);

  // Pure computation — only uses state/props
  const remaining = deadline
    ? Math.max(0, Math.ceil((new Date(deadline).getTime() - now) / 1000))
    : 0;

  // Trigger onExpire when remaining hits 0
  useEffect(() => {
    if (remaining === 0 && deadline && !firedRef.current) {
      firedRef.current = true;
      onExpireRef.current?.();
    }
  }, [remaining, deadline]);

  return remaining;
}
