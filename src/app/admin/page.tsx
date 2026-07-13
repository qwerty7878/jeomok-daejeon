"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import { Shield, CheckCircle, XCircle, Clock, Home, Upload, EyeOff, Eye } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Report {
  id: string;
  room_code: string | null;
  reporter_session: string;
  target_type: "chat" | "title";
  target_content: string;
  context: string | null;
  status: "pending" | "reviewed" | "dismissed";
  created_at: string;
}

interface Stats {
  pendingReports: number;
  totalRooms: number;
  totalGames: number;
  recentRooms: Array<{ code: string; name: string; phase: string; created_at: string }>;
}

interface LibraryImage {
  id: string;
  url: string;
  source: string;
  license: string;
  source_url: string;
  category: string;
  active: boolean;
  exposures: number;
  vote_variance: number | null;
}

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<"reports" | "rooms" | "images">("reports");
  const [status, setStatus] = useState<"pending" | "reviewed" | "dismissed">("pending");
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [images, setImages] = useState<LibraryImage[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const headers = { "x-admin-secret": secret };

  const fetchStats = useCallback(() => {
    if (!authed) return;
    fetch("/api/admin/reports", { method: "POST", headers })
      .then((r) => r.ok ? r.json() : null)
      .then((d: Stats | null) => { if (d) setStats(d); });
  }, [authed, secret]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchReports = useCallback(() => {
    if (!authed) return;
    setLoading(true);
    fetch(`/api/admin/reports?status=${status}`, { headers })
      .then((r) => r.ok ? r.json() : null)
      .then((d: { reports: Report[] } | null) => { if (d) setReports(d.reports); })
      .finally(() => setLoading(false));
  }, [authed, status, secret]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchImages = useCallback(() => {
    if (!authed) return;
    setImagesLoading(true);
    fetch("/api/admin/images", { headers })
      .then((r) => r.ok ? r.json() : null)
      .then((d: { images: LibraryImage[] } | null) => { if (d) setImages(d.images); })
      .finally(() => setImagesLoading(false));
  }, [authed, secret]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t0 = setTimeout(() => {
      fetchStats();
      fetchReports();
      fetchImages();
    }, 0);
    return () => clearTimeout(t0);
  }, [fetchStats, fetchReports, fetchImages]);

  async function uploadImage(formEl: HTMLFormElement) {
    setUploadError("");
    const fd = new FormData(formEl);
    if (!fd.get("file") || !(fd.get("file") as File).size) {
      setUploadError("파일을 선택하세요");
      return;
    }
    setUploading(true);
    const res = await fetch("/api/admin/images", { method: "POST", headers, body: fd });
    setUploading(false);
    if (res.ok) {
      formEl.reset();
      if (fileRef.current) fileRef.current.value = "";
      fetchImages();
    } else {
      const d = await res.json().catch(() => null);
      setUploadError(d?.error?.message ?? "업로드 실패");
    }
  }

  async function toggleActive(img: LibraryImage) {
    setImages((prev) => prev.map((i) => (i.id === img.id ? { ...i, active: !i.active } : i)));
    await fetch("/api/admin/images", {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ id: img.id, active: !img.active }),
    });
  }

  async function login() {
    const res = await fetch("/api/admin/reports?status=pending", {
      headers: { "x-admin-secret": secret },
    });
    if (res.ok) {
      setAuthed(true);
      setError("");
    } else {
      setError("잘못된 어드민 시크릿");
    }
  }

  async function updateStatus(id: string, newStatus: "reviewed" | "dismissed") {
    await fetch("/api/admin/reports", {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: newStatus }),
    });
    setReports((prev) => prev.filter((r) => r.id !== id));
  }

  if (!authed) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-8">
        <div className="flex items-center gap-2">
          <Shield size={24} className="text-primary" />
          <h1 className="font-display text-2xl">어드민</h1>
        </div>
        <div className="w-full max-w-sm space-y-3">
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") login(); }}
            placeholder="어드민 시크릿 키"
            className="h-12 w-full rounded-2xl border-2 border-input bg-background px-4 text-base outline-none focus:border-primary"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            onClick={login}
            className="h-12 w-full rounded-2xl bg-primary font-bold text-primary-foreground"
          >
            접속
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 border-b-2 border-foreground/10 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-primary" />
            <span className="font-display text-lg">어드민</span>
          </div>
          <Link href="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <Home size={14} /> 로비
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="미처리 신고" value={stats.pendingReports} highlight={stats.pendingReports > 0} />
            <StatCard label="전체 방" value={stats.totalRooms} />
            <StatCard label="완료 게임" value={stats.totalGames} />
            <StatCard label="현재 활성 방" value={stats.recentRooms.filter((r) => r.phase !== "GAME_OVER").length} />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 border-b-2 border-foreground/10">
          {(["reports", "rooms", "images"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-2 text-sm font-bold transition-colors",
                tab === t ? "border-b-2 border-primary text-primary" : "text-muted-foreground"
              )}
            >
              {t === "reports" ? "신고 관리" : t === "rooms" ? "방 현황" : "이미지"}
            </button>
          ))}
        </div>

        {tab === "reports" && (
          <section className="space-y-4">
            <div className="flex gap-2">
              {(["pending", "reviewed", "dismissed"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={cn(
                    "rounded-full border-2 px-3 py-1 text-xs font-bold transition-colors",
                    status === s ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground"
                  )}
                >
                  {s === "pending" ? "미처리" : s === "reviewed" ? "처리됨" : "무시됨"}
                </button>
              ))}
            </div>

            {loading ? (
              <p className="text-center text-muted-foreground">로딩 중...</p>
            ) : reports.length === 0 ? (
              <p className="rounded-2xl border-2 border-dashed border-border p-8 text-center text-muted-foreground">신고 없음</p>
            ) : (
              <ul className="space-y-3">
                {reports.map((r) => (
                  <li key={r.id} className="rounded-2xl border-2 border-border bg-card p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-bold",
                            r.target_type === "chat" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
                          )}>
                            {r.target_type === "chat" ? "채팅" : "제목"}
                          </span>
                          {r.room_code && (
                            <span className="text-xs text-muted-foreground">방: {r.room_code}</span>
                          )}
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock size={10} />{new Date(r.created_at).toLocaleString("ko-KR")}
                          </span>
                        </div>
                        <p className="font-bold break-words">&ldquo;{r.target_content}&rdquo;</p>
                        {r.context && (
                          <p className="text-xs text-muted-foreground">작성자: {r.context}</p>
                        )}
                      </div>
                      {r.status === "pending" && (
                        <div className="flex shrink-0 gap-2">
                          <button
                            onClick={() => updateStatus(r.id, "reviewed")}
                            className="flex items-center gap-1 rounded-xl bg-green-100 px-2.5 py-1.5 text-xs font-bold text-green-700 hover:bg-green-200"
                          >
                            <CheckCircle size={12} /> 처리
                          </button>
                          <button
                            onClick={() => updateStatus(r.id, "dismissed")}
                            className="flex items-center gap-1 rounded-xl bg-muted px-2.5 py-1.5 text-xs font-bold text-muted-foreground hover:bg-muted/80"
                          >
                            <XCircle size={12} /> 무시
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {tab === "rooms" && stats && (
          <section>
            <ul className="space-y-2">
              {stats.recentRooms.map((r) => (
                <li key={r.code} className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card px-4 py-3">
                  <span className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-xs font-bold",
                    r.phase === "WAITING" ? "bg-secondary/20 text-secondary" :
                    r.phase === "GAME_OVER" ? "bg-muted text-muted-foreground" :
                    "bg-accent/20 text-accent-foreground"
                  )}>
                    {r.phase}
                  </span>
                  <span className="font-bold flex-1 truncate">{r.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{r.code}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString("ko-KR")}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {tab === "images" && (
          <section className="space-y-4">
            <form
              onSubmit={(e) => { e.preventDefault(); uploadImage(e.currentTarget); }}
              className="space-y-3 rounded-2xl border-2 border-border bg-card p-4"
            >
              <p className="flex items-center gap-2 font-bold"><Upload size={16} /> 라이브러리 이미지 업로드</p>
              <p className="text-xs text-muted-foreground">
                외부 API(Met/Pexels)로 못 채우는 자체 AI 생성 이미지 등을 등록할 때 사용합니다.
                업로드된 이미지는 <b>모든 방에서 공용으로</b> 재사용됩니다 (room 전용 업로드가 아님).
              </p>
              <input ref={fileRef} type="file" name="file" accept="image/jpeg,image/png,image/webp" required
                className="block w-full text-sm" />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <select name="source" required defaultValue="AI" className="rounded-xl border-2 border-input bg-background px-2 py-2 text-sm">
                  <option value="AI">AI 생성</option>
                  <option value="USER">직접 촬영/제작</option>
                </select>
                <select name="license" required defaultValue="OWN" className="rounded-xl border-2 border-input bg-background px-2 py-2 text-sm">
                  <option value="OWN">자체 자산 (OWN)</option>
                  <option value="CC0">CC0</option>
                  <option value="PD">Public Domain</option>
                  <option value="KOGL-1">공공누리 1유형</option>
                </select>
                <select name="category" defaultValue="other" className="rounded-xl border-2 border-input bg-background px-2 py-2 text-sm">
                  <option value="art">art</option>
                  <option value="nature">nature</option>
                  <option value="people">people</option>
                  <option value="animals">animals</option>
                  <option value="other">other</option>
                </select>
                <input type="text" name="era" placeholder="시대 (선택)" className="rounded-xl border-2 border-input bg-background px-2 py-2 text-sm" />
              </div>
              <input type="text" name="source_url" required placeholder="출처 URL (필수 — 공공누리·CC0 출처표시 의무)"
                className="w-full rounded-xl border-2 border-input bg-background px-3 py-2 text-sm" />
              {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
              <button type="submit" disabled={uploading}
                className="h-10 w-full rounded-xl bg-primary font-bold text-primary-foreground disabled:opacity-50">
                {uploading ? "업로드 중..." : "업로드"}
              </button>
            </form>

            {imagesLoading ? (
              <p className="text-center text-muted-foreground">로딩 중...</p>
            ) : images.length === 0 ? (
              <p className="rounded-2xl border-2 border-dashed border-border p-8 text-center text-muted-foreground">등록된 이미지 없음</p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {images.map((img) => (
                  <li key={img.id} className={cn(
                    "space-y-1 overflow-hidden rounded-2xl border-2 bg-card",
                    img.active ? "border-border" : "border-destructive/40 opacity-60"
                  )}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt="" className="h-28 w-full object-cover" />
                    <div className="space-y-1 p-2">
                      <p className="truncate text-xs text-muted-foreground">{img.source} · {img.category}</p>
                      <button
                        onClick={() => toggleActive(img)}
                        className={cn(
                          "flex w-full items-center justify-center gap-1 rounded-lg px-2 py-1 text-xs font-bold",
                          img.active ? "bg-muted text-muted-foreground hover:bg-muted/80" : "bg-green-100 text-green-700 hover:bg-green-200"
                        )}
                      >
                        {img.active ? <><EyeOff size={12} /> 비활성화</> : <><Eye size={12} /> 활성화</>}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={cn(
      "rounded-2xl border-2 p-4 text-center",
      highlight ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"
    )}>
      <p className={cn("text-3xl font-display", highlight ? "text-destructive" : "text-foreground")}>{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

