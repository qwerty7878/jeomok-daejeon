import { createServerClient, SupabaseServerClient } from "@/lib/supabase/server";
import { broadcast, roomChannel } from "@/lib/broadcast";

interface SubmissionRow { id: string; title: string; player_id: string; }
interface VoteRow { submission_id: string; }
interface PlayerRow { id: string; nickname: string; lives: number; alive: boolean; connected: boolean; team: string | null; }
interface ImageRow { id: string; url: string; }

// submission_id → normalized AI score (0–1). Returns 0.5 (neutral) on failure.
async function computeAIScores(
  apiKey: string | null,
  imageUrl: string | null,
  subs: SubmissionRow[],
): Promise<Record<string, number>> {
  const neutral = Object.fromEntries(subs.map((s) => [s.id, 0.5]));
  if (!apiKey || !imageUrl || subs.length === 0) return neutral;
  try {
    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({ apiKey });
    const numbered = subs.map((s, i) => `${i + 1}. ${s.title}`).join("\n");
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 80,
      messages: [
        {
          role: "system",
          content: "CTR 예측 전문가. 사진과 제목 후보들을 보고 각 제목의 클릭 충동도를 1~10점으로 평가. 궁금증·유머·반전·감정 자극 기준. JSON만 반환: {\"s\":[점수,...]}",
        },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
            { type: "text", text: `제목 후보:\n${numbered}\n\n{\"s\":[]} 형식으로만:` },
          ],
        },
      ],
    });
    const raw = res.choices[0]?.message?.content?.trim() ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return neutral;
    const parsed = JSON.parse(match[0]) as { s?: unknown[] };
    if (!Array.isArray(parsed.s) || parsed.s.length !== subs.length) return neutral;
    return Object.fromEntries(
      subs.map((sub, i) => [sub.id, Math.max(0, Math.min(10, Number(parsed.s![i]) || 5)) / 10])
    );
  } catch {
    return neutral;
  }
}

export async function computeAndBroadcastResult(code: string, round: number) {
  const db = createServerClient();

  const isMissingCol = (e: unknown) => {
    const m = (e as { message?: string })?.message ?? "";
    return m.includes("Could not find the") || m.includes("does not exist");
  };

  // Room
  const { data: initialRoom, error: roomErr } = await db
    .from("rooms").select("id,game_mode,current_image").eq("code", code).single() as {
      data: { id: string; game_mode: string; current_image: string | null } | null;
      error: unknown;
    };

  let room: { id: string; game_mode: string; current_image: string | null } | null = initialRoom;
  if (isMissingCol(roomErr)) {
    const fb = await db.from("rooms").select("id,game_mode").eq("code", code).single() as { data: { id: string; game_mode: string } | null; error: unknown };
    if (isMissingCol(fb.error)) {
      const fb2 = await db.from("rooms").select("id").eq("code", code).single() as { data: { id: string } | null; error: unknown };
      room = fb2.data ? { ...fb2.data, game_mode: "SOLO", current_image: null } : null;
    } else {
      room = fb.data ? { ...fb.data, current_image: null } : null;
    }
  }
  if (!room) return;

  // Submissions + votes
  const { data: subs } = await db
    .from("submissions").select("id,title,player_id")
    .eq("room_id", room.id).eq("round", round) as { data: SubmissionRow[] | null };

  const { data: votes } = await db
    .from("votes").select("submission_id")
    .eq("room_id", room.id).eq("round", round) as { data: VoteRow[] | null };

  const voteCounts: Record<string, number> = {};
  for (const v of votes ?? []) {
    voteCounts[v.submission_id] = (voteCounts[v.submission_id] ?? 0) + 1;
  }

  // Nicknames
  const playerIds = [...new Set((subs ?? []).map((s) => s.player_id))];
  const { data: nickPlayers } = playerIds.length > 0
    ? await db.from("players").select("id,nickname").in("id", playerIds) as { data: Array<{ id: string; nickname: string }> | null }
    : { data: [] };
  const nickMap: Record<string, string> = {};
  for (const p of nickPlayers ?? []) nickMap[p.id] = p.nickname;

  // Image URL for AI scoring
  let aiImageUrl: string | null = null;
  if (room.current_image) {
    const { data: imgData } = await db.from("images").select("url")
      .eq("id", room.current_image).single() as { data: { url: string } | null };
    aiImageUrl = imgData?.url ?? null;
  }

  // AI scoring (async, falls back to 0.5 neutral on failure)
  const aiScoreMap = await computeAIScores(process.env.OPENAI_API_KEY ?? null, aiImageUrl, subs ?? []);

  // Build scored submissions: finalScore = userVotePct * 0.7 + aiScore * 0.3
  const totalUserVotes = (votes ?? []).length;
  const EPS = 1e-9;

  const scoredSubs = (subs ?? []).map((s) => {
    const v = voteCounts[s.id] ?? 0;
    const userPct = totalUserVotes > 0 ? v / totalUserVotes : 0;
    const aiRaw = aiScoreMap[s.id] ?? 0.5;
    return {
      submissionId: s.id,
      playerId: s.player_id,
      title: s.title,
      votes: v,
      aiScore: Math.round(aiRaw * 100), // 0–100 for display
      finalScore: userPct * 0.7 + aiRaw * 0.3,
    };
  });

  // Ranking sorted by finalScore desc
  const ranking = [...scoredSubs]
    .sort((a, b) => b.finalScore - a.finalScore)
    .map((s) => ({
      id: s.playerId,
      title: s.title,
      author: nickMap[s.playerId] ?? "?",
      votes: s.votes,
      aiScore: s.aiScore,
    }));

  // Alive players
  const { data: initialAlivePlayers, error: aliveErr } = await db
    .from("players").select("id,lives,team")
    .eq("room_id", room.id).eq("alive", true) as { data: Array<{ id: string; lives: number; team: string | null }> | null; error: unknown };

  let alivePlayers = initialAlivePlayers;
  if (isMissingCol(aliveErr)) {
    const fb = await db.from("players").select("id,lives")
      .eq("room_id", room.id).eq("alive", true) as { data: Array<{ id: string; lives: number }> | null; error: unknown };
    alivePlayers = (fb.data ?? []).map((p) => ({ ...p, team: null }));
  }

  const submittedIds = new Set((subs ?? []).map((s) => s.player_id));
  const nonSubmitterIds = (alivePlayers ?? []).filter((p) => !submittedIds.has(p.id)).map((p) => p.id);

  // Loser determination
  let loserPlayerIds: string[];
  let skipNonSubmitterPenalty = false;

  if (room.game_mode === "TEAM") {
    skipNonSubmitterPenalty = true;
    const teamPlayers: Record<string, string[]> = {};
    for (const p of alivePlayers ?? []) {
      const team = p.team ?? "A";
      if (!teamPlayers[team]) teamPlayers[team] = [];
      teamPlayers[team].push(p.id);
    }
    // Sum finalScores per team
    const teamScores: Record<string, number> = {};
    for (const s of scoredSubs) {
      const player = (alivePlayers ?? []).find((p) => p.id === s.playerId);
      const team = player?.team ?? "A";
      teamScores[team] = (teamScores[team] ?? 0) + s.finalScore;
    }
    const activeTeams = Object.keys(teamPlayers);
    if (activeTeams.length < 2) {
      loserPlayerIds = [];
    } else {
      const [teamA, teamB] = activeTeams;
      const sA = teamScores[teamA] ?? 0;
      const sB = teamScores[teamB] ?? 0;
      const losingTeam = Math.abs(sA - sB) < EPS
        ? (Math.random() < 0.5 ? teamA : teamB)
        : (sA < sB ? teamA : teamB);
      loserPlayerIds = teamPlayers[losingTeam] ?? [];
    }
  } else {
    // SOLO: 최저 finalScore 보유자 전원 -1
    const minFinalScore = scoredSubs.length > 0 ? Math.min(...scoredSubs.map((s) => s.finalScore)) : Infinity;
    loserPlayerIds = isFinite(minFinalScore)
      ? scoredSubs.filter((s) => s.finalScore <= minFinalScore + EPS).map((s) => s.playerId)
      : [];
  }

  const toDeduct = skipNonSubmitterPenalty
    ? [...new Set(loserPlayerIds)]
    : [...new Set([...loserPlayerIds, ...nonSubmitterIds])];
  const eliminatedPlayerIds: string[] = [];

  for (const playerId of toDeduct) {
    const player = (alivePlayers ?? []).find((p) => p.id === playerId);
    if (!player) continue;
    const newLives = player.lives - 1;
    await db.from("players").update({ lives: newLives, alive: newLives > 0 }).eq("id", playerId);
    if (newLives <= 0) eliminatedPlayerIds.push(playerId);
  }

  const { data: updatedPlayers } = await db
    .from("players").select("id,nickname,lives,alive,connected,team")
    .eq("room_id", room.id) as { data: PlayerRow[] | null };

  const livesMap: Record<string, number> = {};
  for (const p of updatedPlayers ?? []) livesMap[p.id] = p.lives;

  await broadcast(roomChannel(code), "ROUND_RESULT", {
    ranking,
    eliminated: eliminatedPlayerIds,
    losers: toDeduct,
    lives: livesMap,
  });
  await broadcast(roomChannel(code), "PLAYER_UPDATE", {
    players: updatedPlayers?.map((p) => ({
      id: p.id, nickname: p.nickname, lives: p.lives,
      alive: p.alive, connected: p.connected, team: p.team ?? null,
    })),
  });
}

export async function pickNextImage(
  db: SupabaseServerClient,
  usedImages: string[],
  imageCategory?: string | null,
  imageSource?: string | null,
  roomCode?: string | null,
): Promise<{ id: string; url: string } | null> {
  const noImages = usedImages.length === 0 ? ["00000000-0000-0000-0000-000000000000"] : usedImages;

  const isMissingColImg = (e: unknown) => { const m = (e as { message?: string })?.message ?? ""; return m.includes("Could not find the") || m.includes("does not exist"); };

  if (imageSource === "CUSTOM" && roomCode) {
    const { data, error: ce } = await db
      .from("images").select("id,url").eq("active", true).eq("room_id", roomCode)
      .not("id", "in", `(${noImages.join(",")})`)
      .limit(100) as { data: ImageRow[] | null; error: unknown };
    if (isMissingColImg(ce)) return null;
    if (!data || data.length === 0) return null;
    return data[Math.floor(Math.random() * data.length)];
  }

  const { error: roomIdCheckErr } = await db.from("images").select("room_id").limit(0);
  const hasRoomIdCol = !isMissingColImg(roomIdCheckErr);

  const { error: catCheckErr } = await db.from("images").select("category").limit(0);
  const hasCategoryCol = !isMissingColImg(catCheckErr);

  const buildQuery = () => {
    let q = db.from("images").select("id,url").eq("active", true)
      .not("id", "in", `(${noImages.join(",")})`);
    if (hasRoomIdCol) q = q.is("room_id", null);
    if (hasCategoryCol && imageCategory && imageCategory !== "random") q = q.eq("category", imageCategory);
    return q.limit(100);
  };

  const { data } = await buildQuery() as { data: ImageRow[] | null };
  if (!data || data.length === 0) {
    const { data: fallback } = await db
      .from("images").select("id,url").eq("active", true)
      .not("id", "in", `(${noImages.join(",")})`)
      .limit(100) as { data: ImageRow[] | null };
    if (!fallback || fallback.length === 0) return null;
    return fallback[Math.floor(Math.random() * fallback.length)];
  }
  return data[Math.floor(Math.random() * data.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export { shuffle };
