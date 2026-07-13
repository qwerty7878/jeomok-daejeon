import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export interface HofTitle {
  title: string;
  votes: number;
  imageUrl: string | null;
  round: number;
}

export interface HofPlayer {
  author: string;
  totalVotes: number;
  topTitles: HofTitle[];
}

export async function GET() {
  const db = createServerClient();

  // highlights + 이미지 URL 한 번에 가져오기
  const { data: rows } = await db
    .from("highlights")
    .select("title, author, votes, round, image_id, images(url)")
    .order("votes", { ascending: false })
    .limit(500) as {
      data: Array<{
        title: string;
        author: string;
        votes: number;
        round: number;
        image_id: string | null;
        images: { url: string } | null;
      }> | null;
    };

  if (!rows || rows.length === 0) {
    return NextResponse.json({ players: [] });
  }

  // 플레이어별 집계: 총 득표 + 제목 목록
  const playerMap = new Map<string, { totalVotes: number; titles: HofTitle[] }>();

  for (const row of rows) {
    const author = row.author ?? "?";
    if (!playerMap.has(author)) {
      playerMap.set(author, { totalVotes: 0, titles: [] });
    }
    const entry = playerMap.get(author)!;
    entry.totalVotes += row.votes ?? 0;
    entry.titles.push({
      title: row.title,
      votes: row.votes ?? 0,
      imageUrl: row.images?.url ?? null,
      round: row.round,
    });
  }

  // 총 득표 내림차순 정렬 → 상위 10명
  const players: HofPlayer[] = [...playerMap.entries()]
    .sort((a, b) => b[1].totalVotes - a[1].totalVotes)
    .slice(0, 10)
    .map(([author, { totalVotes, titles }]) => ({
      author,
      totalVotes,
      // 득표 많은 순 상위 3개
      // 득표 많은 순 + 이미지 중복 제거 → 상위 3개
      topTitles: (() => {
        const seen = new Set<string>();
        const result: HofTitle[] = [];
        for (const t of titles.sort((a, b) => b.votes - a.votes)) {
          if (result.length >= 3) break;
          if (t.imageUrl !== null && seen.has(t.imageUrl)) continue;
          if (t.imageUrl !== null) seen.add(t.imageUrl);
          result.push(t);
        }
        return result;
      })(),
    }));

  return NextResponse.json({ players });
}
