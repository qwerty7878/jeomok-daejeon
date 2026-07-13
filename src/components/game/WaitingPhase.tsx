"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { Copy, Link2, Play, Users, Heart, Clock, Flag, Bot, Pencil, Check, X, Upload, Trash2, ImageIcon, ChevronDown, ChevronUp } from "lucide-react";
import { GameButton } from "@/components/ui/GameButton";
import { HowToPlayButton } from "@/components/ui/HowToPlay";
import { cn } from "@/lib/utils";
import type { RoomState } from "@/types/game";

interface Props {
  state: RoomState;
  sessionId: string;
  inviteToken: string;
}

export function WaitingPhase({ state, sessionId }: Props) {
  const [starting, setStarting] = useState(false);
  const [addingBot, setAddingBot] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [editingNick, setEditingNick] = useState(false);
  const [nickInput, setNickInput] = useState("");
  const [editSettings, setEditSettings] = useState(false);
  const [settingLives, setSettingLives] = useState(state.room.lives);
  const [settingMaxPlayers, setSettingMaxPlayers] = useState(state.room.maxPlayers);
  const [settingWriteSec, setSettingWriteSec] = useState(state.room.writeSec);
  const [savingSettings, setSavingSettings] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<Array<{ id: string; url: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isHost =
    state.players.find((p) => p.id === state.me.playerId)?.isHost ?? false;
  const isCustom = state.room.imageSource === "CUSTOM";

  const fetchUploadedImages = useCallback(() => {
    if (!isCustom || !isHost) return;
    fetch(`/api/rooms/${state.room.code}/images`, { headers: { "x-session-id": sessionId } })
      .then((r) => r.ok ? r.json() : null)
      .then((d: { images: Array<{ id: string; url: string }> } | null) => {
        if (d) setUploadedImages(d.images);
      });
  }, [isCustom, isHost, state.room.code, sessionId]);

  useEffect(() => {
    const t0 = setTimeout(() => { fetchUploadedImages(); }, 0);
    return () => clearTimeout(t0);
  }, [fetchUploadedImages]);
  const aliveCount = state.players.filter((p) => p.alive).length;
  const canStart = aliveCount >= 3;
  const botCount = state.players.filter((p) => p.nickname.startsWith("봇")).length;
  const canAddBot = aliveCount < state.room.maxPlayers && botCount < 5;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }

  async function start() {
    if (!canStart || starting) return;
    setStarting(true);
    try {
      const res = await fetch(`/api/rooms/${state.room.code}/start`, {
        method: "POST",
        headers: { "x-session-id": sessionId },
      });
      if (!res.ok) {
        const data = await res.json() as { error: { message: string } };
        showToast(data.error?.message ?? "시작 실패");
      }
    } finally {
      setStarting(false);
    }
  }

  async function addBot() {
    if (!canAddBot || addingBot) return;
    setAddingBot(true);
    try {
      const res = await fetch(`/api/rooms/${state.room.code}/bot`, {
        method: "POST",
        headers: { "x-session-id": sessionId },
      });
      const data = await res.json() as { nickname?: string; error?: { message: string } };
      if (res.ok) {
        showToast(`${data.nickname} 추가됨`);
      } else {
        showToast(data.error?.message ?? "봇 추가 실패");
      }
    } finally {
      setAddingBot(false);
    }
  }

  const myNickname = state.players.find((p) => p.id === state.me.playerId)?.nickname ?? "";

  async function saveNickname() {
    const trimmed = nickInput.trim();
    if (trimmed.length < 2) { showToast("2자 이상 입력해주세요"); return; }
    const res = await fetch(`/api/rooms/${state.room.code}/nickname`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-session-id": sessionId },
      body: JSON.stringify({ nickname: trimmed }),
    });
    if (res.ok) {
      localStorage.setItem("nickname", trimmed);
      setEditingNick(false);
      showToast("닉네임 변경됨");
    } else {
      const d = await res.json() as { error: { message: string } };
      showToast(d.error?.message ?? "변경 실패");
    }
  }

  async function uploadImage(file: File) {
    if (uploading) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/rooms/${state.room.code}/images`, {
        method: "POST",
        headers: { "x-session-id": sessionId },
        body: fd,
      });
      const data = await res.json() as { id?: string; url?: string; error?: { message: string } };
      if (res.ok && data.id && data.url) {
        setUploadedImages((prev) => [...prev, { id: data.id!, url: data.url! }]);
        showToast("이미지 업로드 완료");
      } else {
        showToast(data.error?.message ?? "업로드 실패");
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function deleteImage(id: string) {
    const res = await fetch(`/api/rooms/${state.room.code}/images`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-session-id": sessionId },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setUploadedImages((prev) => prev.filter((img) => img.id !== id));
      showToast("이미지 삭제됨");
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(state.room.code);
    showToast("방 코드 복사됨");
  }

  function copyInvite() {
    const url = `${location.origin}/join/${state.room.code}`;
    navigator.clipboard.writeText(url);
    showToast("초대 링크 복사됨");
  }

  async function saveSettings() {
    setSavingSettings(true);
    try {
      const res = await fetch(`/api/rooms/${state.room.code}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-session-id": sessionId },
        body: JSON.stringify({ lives: settingLives, maxPlayers: settingMaxPlayers, writeSec: settingWriteSec }),
      });
      if (res.ok) {
        showToast("설정 저장됨");
        setEditSettings(false);
      } else {
        const d = await res.json() as { error: { message: string } };
        showToast(d.error?.message ?? "저장 실패");
      }
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      {toast && (
        <div className="fixed right-4 top-20 z-50 gs-pop rounded-2xl border-2 border-secondary/30 bg-card px-4 py-3 text-sm font-bold text-secondary shadow-xl">
          {toast}
        </div>
      )}

      {/* Room info */}
      <div className="rounded-2xl border-2 border-border bg-card p-6 text-center">
        <h1 className="font-display text-2xl text-balance">{state.room.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">게임 시작을 기다리는 중이에요</p>

        <div className="mx-auto mt-5 flex max-w-sm flex-wrap items-center justify-center gap-2">
          <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm font-bold">
            <span className="text-muted-foreground">방 코드</span>
            <span className="font-mono tracking-widest text-foreground">
              {state.room.code}
            </span>
            <button
              onClick={copyCode}
              aria-label="코드 복사"
              className="text-muted-foreground hover:text-primary"
            >
              <Copy size={15} />
            </button>
          </div>
          <GameButton onClick={copyInvite} variant="secondary" size="sm">
            <Link2 size={15} /> 초대 링크
          </GameButton>
          <HowToPlayButton size="sm" />
        </div>

        {/* Nickname edit */}
        <div className="mx-auto mt-4 flex max-w-xs items-center justify-center gap-2">
          {editingNick ? (
            <>
              <input
                value={nickInput}
                onChange={(e) => setNickInput(e.target.value.slice(0, 8))}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) saveNickname(); if (e.key === "Escape") setEditingNick(false); }}
                autoFocus
                maxLength={8}
                className="h-8 w-32 rounded-xl border-2 border-primary bg-background px-3 text-sm outline-none"
              />
              <button onClick={saveNickname} className="grid size-8 place-items-center rounded-xl bg-secondary text-secondary-foreground"><Check size={14} /></button>
              <button onClick={() => setEditingNick(false)} className="grid size-8 place-items-center rounded-xl border-2 border-border text-muted-foreground"><X size={14} /></button>
            </>
          ) : (
            <button
              onClick={() => { setNickInput(myNickname); setEditingNick(true); }}
              className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition"
            >
              <span>{myNickname}</span>
              <Pencil size={13} />
            </button>
          )}
        </div>

        {/* Settings summary — 방장은 클릭해서 편집 */}
        <div className="mt-4">
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <SummaryStat icon={<Users size={16} />} label="정원" value={`${state.room.maxPlayers}명`} />
            <SummaryStat icon={<Heart size={16} />} label="목숨" value={`${state.room.lives}개`} />
            <SummaryStat icon={<Flag size={16} />} label="현재인원" value={`${aliveCount}명`} />
            <SummaryStat icon={<Clock size={16} />} label="제한시간" value={`${state.room.writeSec}초`} />
          </div>
          {isHost && (
            <button
              onClick={() => { setEditSettings((v) => !v); setSettingLives(state.room.lives); setSettingMaxPlayers(state.room.maxPlayers); setSettingWriteSec(state.room.writeSec); }}
              className="mt-2 flex w-full items-center justify-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <Pencil size={11} />
              설정 변경
              {editSettings ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
          )}
          {isHost && editSettings && (
            <div className="mt-3 rounded-xl border-2 border-border bg-muted/50 p-4 space-y-3">
              <SettingStepper label="목숨" value={settingLives} min={2} max={5} onChange={setSettingLives} unit="개" />
              <SettingStepper label="최대 인원" value={settingMaxPlayers} min={3} max={12} onChange={setSettingMaxPlayers} unit="명" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">제한 시간</span>
                <div className="flex gap-1.5">
                  {[30, 45, 60].map((t) => (
                    <button key={t} onClick={() => setSettingWriteSec(t)}
                      className={cn("h-8 w-12 rounded-xl border-2 text-sm font-bold transition-colors",
                        settingWriteSec === t ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-foreground/30"
                      )}>{t}초</button>
                  ))}
                </div>
              </div>
              <GameButton onClick={saveSettings} disabled={savingSettings} size="sm" className="w-full">
                {savingSettings ? "저장 중..." : "저장"}
              </GameButton>
            </div>
          )}
        </div>

        {/* Team mode: player team list */}
        {state.room.gameMode === "TEAM" && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {state.players.filter((p) => p.alive).map((p) => (
              <span key={p.id} className={cn(
                "rounded-full px-2.5 py-1 text-xs font-bold",
                p.team === "A" ? "bg-blue-100 text-blue-700" :
                p.team === "B" ? "bg-red-100 text-red-700" :
                "bg-muted text-muted-foreground"
              )}>
                {p.team ? `팀${p.team} ` : ""}{p.nickname}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Custom image upload (host only, CUSTOM mode) */}
      {isHost && isCustom && (
        <div className="rounded-2xl border-2 border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold">
              <ImageIcon size={16} className="text-muted-foreground" />
              <span>커스텀 이미지 ({uploadedImages.length}/20)</span>
            </div>
            <GameButton
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || uploadedImages.length >= 20}
              variant="outline"
              size="sm"
            >
              <Upload size={14} />
              {uploading ? "업로드 중..." : "이미지 추가"}
            </GameButton>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); }}
          />
          {uploadedImages.length === 0 ? (
            <p className="rounded-xl border-2 border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              이미지를 추가해야 게임에서 사용됩니다 (최소 1장)
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {uploadedImages.map((img) => (
                <div key={img.id} className="group relative aspect-square overflow-hidden rounded-xl border-2 border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                  <button
                    onClick={() => deleteImage(img.id)}
                    className="absolute inset-0 grid place-items-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label="삭제"
                  >
                    <Trash2 size={18} className="text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Host controls */}
      {isHost ? (
        <div className="rounded-2xl border-2 border-border bg-card p-4">
          <div className="flex gap-2">
            <GameButton
              onClick={addBot}
              disabled={!canAddBot || addingBot}
              variant="outline"
              size="lg"
            >
              <Bot size={18} />
              {addingBot ? "추가 중..." : "봇 추가"}
            </GameButton>
            <GameButton
              onClick={start}
              disabled={!canStart || starting}
              size="lg"
              className="flex-1 font-serif"
            >
              <Play size={20} className="fill-current" />
              {starting ? "시작 중..." : canStart ? "게임 시작!" : "3명부터 시작 가능"}
            </GameButton>
          </div>
          {!canStart && (
            <p className="mt-2 text-center text-sm text-muted-foreground">
              현재 {aliveCount}명 — 3명 이상 필요합니다
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-border bg-card/50 p-6 text-center">
          <p className="font-bold text-muted-foreground">
            방장이 게임을 시작하기를 기다리는 중...
          </p>
        </div>
      )}
    </div>
  );
}

function SummaryStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl bg-muted px-2 py-3">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-display text-base text-foreground">{value}</span>
    </div>
  );
}

function SettingStepper({ label, value, min, max, onChange, unit }: {
  label: string; value: number; min: number; max: number;
  onChange: (v: number) => void; unit: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-bold">{label}</span>
      <div className="flex items-center gap-2">
        <button onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}
          className="grid size-7 place-items-center rounded-lg border-2 border-border text-muted-foreground disabled:opacity-30 hover:border-foreground/30">
          <ChevronDown size={14} />
        </button>
        <span className="w-12 text-center text-sm font-bold">{value}{unit}</span>
        <button onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}
          className="grid size-7 place-items-center rounded-lg border-2 border-border text-muted-foreground disabled:opacity-30 hover:border-foreground/30">
          <ChevronUp size={14} />
        </button>
      </div>
    </div>
  );
}
