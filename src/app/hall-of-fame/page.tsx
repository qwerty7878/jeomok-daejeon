import Link from "next/link";
import Image from "next/image";
import { Trophy, Crown, Star } from "lucide-react";
import { AdBanner } from "@/components/ads/AdBanner";
import type { HofPlayer } from "@/app/api/hall-of-fame/route";

const RANK_ICONS = ["🥇", "🥈", "🥉"];

async function getData(): Promise<{ players: HofPlayer[] }> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    const res = await fetch(`${baseUrl}/api/hall-of-fame`, { next: { revalidate: 60 } });
    if (!res.ok) return { players: [] };
    return res.json();
  } catch {
    return { players: [] };
  }
}

export default async function HallOfFamePage() {
  const { players } = await getData();

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 border-b-2 border-foreground/10 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Trophy size={20} className="text-accent-foreground" />
            <span className="font-display text-lg">명예의 전당</span>
          </div>
          <Link href="/" className="text-sm font-bold text-muted-foreground hover:text-foreground">
            ← 로비
          </Link>
        </div>
      </header>

      <AdBanner />

      <main className="mx-auto max-w-4xl px-4 py-8">
        {players.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border p-16 text-center text-muted-foreground">
            <Trophy size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-display text-lg">아직 기록이 없어요.</p>
            <p className="mt-1 text-sm">게임을 마치면 베스트 제목이 여기에 쌓여요!</p>
          </div>
        ) : (
          <ol className="space-y-6">
            {players.map((player, idx) => (
              <li key={player.author} className="overflow-hidden rounded-2xl border-2 border-border bg-card">
                {/* Player header */}
                <div className={`flex items-center gap-3 px-5 py-3 ${idx === 0 ? "bg-accent/20" : idx === 1 ? "bg-muted/60" : idx === 2 ? "bg-muted/40" : "bg-muted/20"}`}>
                  <span className="text-2xl leading-none">
                    {idx < 3 ? RANK_ICONS[idx] : `${idx + 1}`}
                  </span>
                  <div className="flex-1">
                    <span className="font-display text-lg">{player.author}</span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full bg-accent/20 px-3 py-1">
                    <Star size={13} className="fill-accent-foreground text-accent-foreground" />
                    <span className="font-display text-sm font-bold text-accent-foreground">
                      총 {player.totalVotes}표
                    </span>
                  </div>
                </div>

                {/* Top 3 titles with images */}
                <div className="divide-y divide-border">
                  {player.topTitles.map((t, ti) => (
                    <div key={`${t.round}-${t.title}`} className="flex items-center gap-4 px-5 py-3">
                      {/* Image thumbnail */}
                      <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-muted">
                        {t.imageUrl ? (
                          <Image
                            src={t.imageUrl}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="56px"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-muted-foreground/30">
                            <Crown size={20} />
                          </div>
                        )}
                      </div>

                      {/* Title */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-base">
                          &ldquo;{t.title}&rdquo;
                        </p>
                      </div>

                      {/* Votes */}
                      <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-sm font-bold tabular-nums">
                        {t.votes}표
                      </span>

                      {/* Top title badge */}
                      {ti === 0 && (
                        <Crown size={16} className="shrink-0 fill-accent text-accent-foreground/70" />
                      )}
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        )}
      </main>
      <AdBanner />
    </div>
  );
}
