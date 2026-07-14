"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Lock,
  Globe,
  Filter,
  Sparkles,
  Pencil,
  Dices,
  Link2,
  User,
  Users,
  Shuffle,
  Palette,
  Leaf,
  PawPrint,
  Package,
  Library,
  FolderOpen,
  Trophy,
} from "lucide-react";
import { useSession } from "@/hooks/useSession";
import { HowToPlayButton } from "@/components/ui/HowToPlay";
import { GameButton } from "@/components/ui/GameButton";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";
import { AdBanner } from "@/components/ads/AdBanner";
import type { PublicRoomItem } from "@/lib/get-public-rooms";

type RoomItem = PublicRoomItem;

const WRITE_TIMES = [30, 45, 60];
const IMAGE_CATEGORIES = [
  { value: "random", label: "랜덤", Icon: Shuffle },
  { value: "art", label: "미술", Icon: Palette },
  { value: "nature", label: "자연", Icon: Leaf },
  { value: "people", label: "사람", Icon: Users },
  { value: "animals", label: "동물", Icon: PawPrint },
  { value: "other", label: "기타", Icon: Package },
];

export function LobbyClient({ initialRooms }: { initialRooms: RoomItem[] }) {
  const { sessionId, nickname, saveNickname } = useSession();
  const router = useRouter();

  const [rooms, setRooms] = useState<RoomItem[]>(initialRooms);
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [hideLocked, setHideLocked] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [nicknameOpen, setNicknameOpen] = useState(false);
  const [editNickOpen, setEditNickOpen] = useState(false);

  const fetchRoomsData = useCallback(async () => {
    try {
      const r = await fetch("/api/rooms");
      if (!r.ok) return null;
      const data = (await r.json()) as { rooms: RoomItem[] };
      return data.rooms ?? null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    // setState only fires inside timer callbacks — never synchronously in effect body
    const poll = () => {
      fetchRoomsData().then((rooms) => {
        if (rooms) setRooms(rooms);
      });
    };
    const t0 = setTimeout(poll, 0);
    const t = setInterval(poll, 5000);
    return () => {
      clearTimeout(t0);
      clearInterval(t);
    };
  }, [fetchRoomsData]);

  // Show nickname modal on first visit
  const needsNickname = !nickname;

  const filtered = rooms.filter((r) => {
    if (hideLocked && r.roomType === "LOCKED") return false;
    if (onlyOpen && (r.status !== "WAITING" || r.playerCount >= r.maxPlayers))
      return false;
    return true;
  });

  function enter(room: RoomItem) {
    if (!nickname) { setNicknameOpen(true); return; }
    if (room.roomType === "LOCKED") {
      setJoinCode(room.code);
      return;
    }
    router.push(`/room/${room.code}`);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b-2 border-foreground/10 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-2">
            <span className="font-serif text-xl leading-none text-foreground">
              <span className="text-primary">제목대전</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/hall-of-fame"
              className="flex items-center gap-1.5 rounded-full border-2 border-input bg-card px-3 py-1.5 text-sm font-bold text-foreground transition-colors hover:border-primary"
            >
              <Trophy className="size-3.5 text-accent-foreground" />
              <span className="hidden sm:inline">명예의 전당</span>
            </Link>
            <button
              onClick={() => setEditNickOpen(true)}
              className="flex items-center gap-1.5 rounded-full border-2 border-input bg-card px-3 py-1.5 text-sm font-bold text-foreground transition-colors hover:border-primary"
            >
              {nickname || "닉네임"}
              <Pencil className="size-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {/* Hero row */}
        <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-balance font-serif text-4xl text-foreground">
              사진 하나에 <span className="text-primary">제목</span>을 붙여봐
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <HowToPlayButton size="sm" />
            <GameButton
              onClick={() => (nickname ? setCreateOpen(true) : setNicknameOpen(true))}
              size="lg"
              className="font-serif"
            >
              <Plus className="size-5" /> 방 만들기
            </GameButton>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Filter className="size-4" /> 필터
          </span>
          <FilterChip active={onlyOpen} onClick={() => setOnlyOpen((v) => !v)}>
            입장 가능한 방만
          </FilterChip>
          <FilterChip active={hideLocked} onClick={() => setHideLocked((v) => !v)}>
            잠금방 숨기기
          </FilterChip>
        </div>

        {/* Room list */}
        {filtered.length === 0 ? (
          <EmptyState onCreate={() => (nickname ? setCreateOpen(true) : setNicknameOpen(true))} />
        ) : (
          <div className="overflow-hidden rounded-3xl border-2 border-foreground/10 bg-card">
            <div className="grid grid-cols-[2rem_1fr_3.5rem_7.5rem] items-center gap-3 border-b-2 border-foreground/10 px-4 py-2.5 text-xs font-bold text-muted-foreground">
              <span>#</span>
              <span>방 제목</span>
              <span className="text-center">인원</span>
              <span className="text-right">상태</span>
            </div>
            {filtered.map((room, i) => (
              <RoomRow
                key={room.code}
                index={i + 1}
                room={room}
                onEnter={() => enter(room)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Ad banner — 환경변수 없으면 렌더링 안 됨 */}
      <AdBanner />

      {/* Footer */}
      <footer className="border-t-2 border-foreground/10 bg-card">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-sm text-muted-foreground sm:flex-row">
          <span className="font-bold text-secondary">제목대전</span>
          <div className="flex items-center gap-4">
            <Link href="/credits" className="transition-colors hover:text-foreground">
              이미지 출처
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-foreground">
              개인정보처리방침
            </Link>
            <Link href="/admin" className="opacity-0 hover:opacity-100 transition-opacity text-[10px]">
              ·
            </Link>
          </div>
        </div>
      </footer>

      {/* Nickname first-time modal */}
      <NicknameModal
        open={needsNickname || nicknameOpen}
        dismissable={!needsNickname}
        onClose={() => setNicknameOpen(false)}
        onSave={(n) => {
          saveNickname(n);
          setNicknameOpen(false);
        }}
        initialValue=""
      />

      {/* Edit nickname modal */}
      <NicknameModal
        open={editNickOpen}
        dismissable
        onClose={() => setEditNickOpen(false)}
        onSave={(n) => {
          saveNickname(n);
          setEditNickOpen(false);
        }}
        initialValue={nickname}
        title="닉네임 수정"
      />

      {/* Create room modal — key remounts component each time it opens to reset state */}
      <CreateRoomModal
        key={createOpen ? `open-${nickname}` : "closed"}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        sessionId={sessionId}
        nickname={nickname}
        onCreated={(code) => router.push(`/room/${code}`)}
      />

      {/* Password gate */}
      {joinCode && (
        <PasswordModal
          code={joinCode}
          onClose={() => setJoinCode(null)}
          sessionId={sessionId}
          nickname={nickname}
          onJoined={() => {
            router.push(`/room/${joinCode}`);
            setJoinCode(null);
          }}
        />
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border-2 px-3 py-1 text-xs font-bold transition-colors",
        active
          ? "border-secondary bg-secondary/10 text-secondary"
          : "border-input text-muted-foreground"
      )}
    >
      {children}
    </button>
  );
}

function RoomRow({
  index,
  room,
  onEnter,
}: {
  index: number;
  room: RoomItem;
  onEnter: () => void;
}) {
  const full = room.playerCount >= room.maxPlayers;
  const waiting = room.status === "WAITING";

  let badge = { label: "대기중", cls: "bg-secondary/15 text-secondary" };
  if (full && waiting)
    badge = { label: "꽉참", cls: "bg-muted text-muted-foreground" };
  else if (!waiting)
    badge = { label: "게임중", cls: "bg-accent/60 text-accent-foreground" };

  const action = !waiting ? "관전" : full ? "꽉참" : "입장";
  const disabled = full && waiting;

  return (
    <div className="grid grid-cols-[2rem_1fr_3.5rem_7.5rem] items-center gap-3 border-b border-foreground/5 px-4 py-3 last:border-0 hover:bg-muted/40">
      <span className="font-serif text-muted-foreground">
        {String(index).padStart(2, "0")}
      </span>
      <span className="flex min-w-0 items-center gap-1.5 font-bold text-foreground">
        {room.roomType === "LOCKED" && (
          <Lock className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate">{room.name}</span>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold",
            badge.cls
          )}
        >
          {badge.label}
        </span>
      </span>
      <span className="text-center text-sm tabular-nums text-muted-foreground">
        {room.playerCount}/{room.maxPlayers}
      </span>
      <div className="flex justify-end">
        <GameButton
          onClick={onEnter}
          disabled={disabled}
          size="sm"
          variant={action === "관전" ? "accent" : "primary"}
          className="w-full"
        >
          {action}
        </GameButton>
      </div>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-foreground/15 bg-card p-10 text-center">
      <Sparkles className="mx-auto size-10 text-primary" />
      <h3 className="mt-3 font-serif text-2xl text-foreground">
        첫 방을 만들어보세요
      </h3>
      <ol className="mx-auto mt-4 max-w-sm space-y-1 text-left text-sm text-muted-foreground">
        <li>1. 옛날 사진이 뜨면 웃긴 제목을 답니다</li>
        <li>2. 서로의 제목에 익명으로 투표합니다</li>
        <li>3. 표를 못 받으면 목숨이 깎여요. 최후의 1인이 우승!</li>
      </ol>
      <GameButton onClick={onCreate} size="lg" className="mt-5 font-serif">
        방 만들기
      </GameButton>
    </div>
  );
}

function NicknameModal({
  open,
  dismissable,
  onClose,
  onSave,
  initialValue,
  title = "닉네임을 정해주세요",
}: {
  open: boolean;
  dismissable: boolean;
  onClose: () => void;
  onSave: (n: string) => void;
  initialValue: string;
  title?: string;
}) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState("");

  function submit() {
    const v = value.trim();
    if (v.length < 2 || v.length > 8) {
      setError("2~8자로 입력해주세요");
      return;
    }
    setError("");
    onSave(v);
  }

  const RANDOM = ["감자도리", "허수아비", "묻지마사나이", "눈깔사탕", "떡갈비맨", "미스터볼드"];
  function randomPick() {
    setValue(RANDOM[Math.floor(Math.random() * RANDOM.length)]);
    setError("");
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      dismissable={dismissable}
      hideClose={!dismissable}
    >
      {!dismissable && (
        <p className="mb-4 text-sm text-muted-foreground">
          로그인은 없어요. 게임에서 쓸 이름만 정하면 바로 시작합니다.
        </p>
      )}
      <div className="flex gap-2">
        <input
          autoFocus
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229)
              submit();
          }}
          placeholder="예: 감자도리"
          maxLength={8}
          className="h-12 flex-1 rounded-2xl border-2 border-input bg-background px-4 text-base outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={randomPick}
          className="grid size-12 shrink-0 place-items-center rounded-2xl border-2 border-input text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          aria-label="랜덤 닉네임"
        >
          <Dices className="size-5" />
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      <GameButton onClick={submit} size="lg" className="mt-5 w-full font-serif">
        {dismissable ? "저장" : "시작하기"}
      </GameButton>
    </Modal>
  );
}

function CreateRoomModal({
  open,
  onClose,
  sessionId,
  nickname,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  nickname: string;
  onCreated: (code: string) => void;
}) {
  // Use key prop from parent to remount on open, so useState picks up fresh nickname
  const [name, setName] = useState(`${nickname || "익명"}의 방`);
  const [roomType, setRoomType] = useState<"PUBLIC" | "LOCKED">("PUBLIC");
  const [password, setPassword] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [lives, setLives] = useState(3);
  const [writeSec, setWriteSec] = useState(45);
  const [imageSource, setImageSource] = useState<"LIBRARY" | "CUSTOM">("LIBRARY");
  const [imageCategory, setImageCategory] = useState("random");
  const [gameMode, setGameMode] = useState<"SOLO" | "TEAM">("SOLO");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    const n = name.trim();
    if (n.length < 1 || n.length > 20) {
      setError("방 이름은 1~20자예요");
      return;
    }
    if (roomType === "LOCKED" && !/^\d{4}$/.test(password)) {
      setError("비밀번호는 숫자 4자리예요");
      return;
    }
    setError("");
    setCreating(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId,
        },
        body: JSON.stringify({
          name: n,
          roomType,
          password: roomType === "LOCKED" ? password : undefined,
          maxPlayers,
          lives,
          writeSec,
          imageSource,
          imageCategory: imageSource === "LIBRARY" ? imageCategory : "random",
          gameMode,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { code: string };
        onClose();
        onCreated(data.code);
      } else {
        const data = (await res.json()) as { error: { message: string } };
        setError(data.error?.message ?? "방 만들기 실패");
      }
    } finally {
      setCreating(false);
    }
  }

  const TYPES = [
    { value: "PUBLIC" as const, icon: Globe, label: "공개방", desc: "로비에 보이고, 누구나 들어옵니다" },
    { value: "LOCKED" as const, icon: Lock, label: "잠금방", desc: "로비에 보이지만 비밀번호가 필요합니다" },
  ];

  return (
    <Modal open={open} onClose={onClose} title="방 만들기" className="max-w-lg">
      <div className="space-y-5">
        <Field label="방 이름">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            className="h-11 w-full rounded-2xl border-2 border-input bg-background px-4 outline-none focus:border-primary"
          />
        </Field>

        <Field label="방 타입">
          <div className="grid gap-2">
            {TYPES.map((t) => {
              const Icon = t.icon;
              const active = roomType === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => setRoomType(t.value)}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition-colors",
                    active
                      ? "border-primary bg-primary/5"
                      : "border-input hover:border-foreground/20"
                  )}
                >
                  <span
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-xl",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span>
                    <span className="block font-bold text-foreground">{t.label}</span>
                    <span className="block text-xs text-muted-foreground">{t.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link2 className="size-3.5 shrink-0" />
            초대 링크로 친구를 부를 수 있어요
          </p>
        </Field>

        {roomType === "LOCKED" && (
          <Field label="비밀번호 (숫자 4자리)">
            <input
              inputMode="numeric"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              placeholder="0000"
              className="h-11 w-40 rounded-2xl border-2 border-input bg-background px-4 text-center text-lg tracking-[0.4em] outline-none focus:border-primary"
            />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label={`최대 인원 · ${maxPlayers}명`}>
            <Stepper
              value={maxPlayers}
              min={3}
              max={12}
              onChange={setMaxPlayers}
            />
          </Field>
          <Field label={`목숨 · ${lives}개`}>
            <Stepper value={lives} min={2} max={5} onChange={setLives} />
          </Field>
        </div>

        <Field label="작성 시간">
          <div className="flex gap-2">
            {WRITE_TIMES.map((t) => (
              <button
                key={t}
                onClick={() => setWriteSec(t)}
                className={cn(
                  "h-10 flex-1 rounded-2xl border-2 font-bold transition-colors",
                  writeSec === t
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input text-muted-foreground hover:border-foreground/20"
                )}
              >
                {t}초
              </button>
            ))}
          </div>
        </Field>

        <Field label="게임 모드">
          <div className="flex gap-2">
            {(["SOLO", "TEAM"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setGameMode(v)}
                className={cn(
                  "h-10 flex-1 rounded-2xl border-2 text-sm font-bold transition-colors flex items-center justify-center gap-1.5",
                  gameMode === v
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input text-muted-foreground hover:border-foreground/20"
                )}
              >
                {v === "SOLO" ? <><User size={14} />개인전</> : <><Users size={14} />팀전</>}
              </button>
            ))}
          </div>
          {gameMode === "TEAM" && (
            <p className="mt-1.5 text-xs text-muted-foreground">시작 시 자동으로 A/B팀이 배정됩니다</p>
          )}
        </Field>

        <Field label="이미지 소스">
          <div className="flex gap-2">
            {(["LIBRARY", "CUSTOM"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setImageSource(v)}
                className={cn(
                  "h-9 flex-1 rounded-2xl border-2 text-sm font-bold transition-colors flex items-center justify-center gap-1.5",
                  imageSource === v
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input text-muted-foreground hover:border-foreground/20"
                )}
              >
                {v === "LIBRARY"
                  ? <><Library size={14} />라이브러리</>
                  : <><FolderOpen size={14} />직접 업로드</>
                }
              </button>
            ))}
          </div>
          {imageSource === "CUSTOM" && (
            <p className="mt-1.5 text-xs text-muted-foreground">대기실에서 방장이 이미지를 업로드합니다</p>
          )}
        </Field>

        {imageSource === "LIBRARY" && (
          <Field label="이미지 카테고리">
            <div className="flex flex-wrap gap-2">
              {IMAGE_CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setImageCategory(c.value)}
                  className={cn(
                    "h-9 rounded-2xl border-2 px-3 text-sm font-bold transition-colors flex items-center gap-1.5",
                    imageCategory === c.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input text-muted-foreground hover:border-foreground/20"
                  )}
                >
                  <c.Icon size={13} />
                  {c.label}
                </button>
              ))}
            </div>
          </Field>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <GameButton
          onClick={create}
          disabled={creating}
          size="lg"
          className="w-full font-serif"
        >
          {creating ? "만드는 중..." : "방 만들기"}
        </GameButton>
      </div>
    </Modal>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-bold text-foreground">{label}</p>
      {children}
    </div>
  );
}

function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex h-11 items-center rounded-2xl border-2 border-input">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        className="grid h-full w-11 place-items-center text-lg font-bold text-muted-foreground hover:text-foreground"
        aria-label="감소"
      >
        −
      </button>
      <span className="flex-1 text-center font-bold text-foreground">
        {value}
      </span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        className="grid h-full w-11 place-items-center text-lg font-bold text-muted-foreground hover:text-foreground"
        aria-label="증가"
      >
        +
      </button>
    </div>
  );
}

function PasswordModal({
  code,
  onClose,
  sessionId,
  nickname,
  onJoined,
}: {
  code: string;
  onClose: () => void;
  sessionId: string;
  nickname: string;
  onJoined: () => void;
}) {
  const [pw, setPw] = useState("");
  const [tries, setTries] = useState(0);
  const [shake, setShake] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  async function tryJoin(candidate: string) {
    const res = await fetch(`/api/rooms/${code}/join`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-id": sessionId,
      },
      body: JSON.stringify({ nickname, password: candidate }),
    });

    if (res.ok) {
      onJoined();
      return;
    }

    const data = (await res.json()) as { error: { code: string; message: string } };
    const errCode = data.error?.code;

    if (errCode === "WRONG_PASSWORD") {
      const next = tries + 1;
      setTries(next);
      setShake(true);
      setPw("");
      setError(data.error.message);
      setTimeout(() => setShake(false), 400);
      if (next >= 5) setCooldown(60);
    } else if (errCode === "PASSWORD_COOLDOWN") {
      setError(data.error.message);
      setCooldown(60);
    } else {
      setError(data.error?.message ?? "입장 실패");
    }
  }

  return (
    <Modal open title="비밀번호 입력" onClose={onClose}>
      <div className={shake ? "gs-shake" : ""}>
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Lock className="size-4" />방 코드: {code}
        </div>
        <input
          autoFocus
          inputMode="numeric"
          value={pw}
          disabled={cooldown > 0}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 4);
            setPw(v);
            setError("");
            if (v.length === 4) tryJoin(v);
          }}
          placeholder="0000"
          className="h-14 w-full rounded-2xl border-2 border-input bg-background text-center text-2xl tracking-[0.6em] outline-none focus:border-primary disabled:opacity-50"
        />
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        {cooldown > 0 && (
          <p className="mt-1 text-sm text-destructive">
            {cooldown}초 후 다시 시도해주세요
          </p>
        )}
      </div>
    </Modal>
  );
}
