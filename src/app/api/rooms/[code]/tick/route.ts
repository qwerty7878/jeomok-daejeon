import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { err, ok, getSessionId } from "@/lib/api-helpers";
import { broadcast, roomChannel } from "@/lib/broadcast";
import { computeAndBroadcastResult, pickNextImage, shuffle } from "@/lib/game/transitions";
import { generateBotTitle, getRoomImageUrl } from "@/lib/game/botTitles";

async function autoBotSubmit(
  db: ReturnType<typeof import("@/lib/supabase/server").createServerClient>,
  roomId: string,
  round: number,
  currentImageId: string | null
) {
  const { data: bots } = await db
    .from("players")
    .select("id")
    .eq("room_id", roomId)
    .eq("alive", true)
    .like("session_id", "bot:%") as { data: Array<{ id: string }> | null };

  if (!bots || bots.length === 0) return;

  const { data: alreadySubmitted } = await db
    .from("submissions")
    .select("player_id")
    .eq("room_id", roomId)
    .eq("round", round) as { data: Array<{ player_id: string }> | null };

  const submittedIds = new Set((alreadySubmitted ?? []).map((s) => s.player_id));
  const pending = bots.filter((b) => !submittedIds.has(b.id));
  if (pending.length === 0) return;

  // 이미지 URL 조회 후 AI로 제목 생성 (봇마다 다른 제목)
  const imageUrl = await getRoomImageUrl(roomId, currentImageId);
  const titles = await Promise.all(pending.map(() => generateBotTitle(imageUrl)));

  await db.from("submissions").insert(
    pending.map((b, i) => ({ room_id: roomId, round, player_id: b.id, title: titles[i] }))
  );
}

async function autoBotVote(
  db: ReturnType<typeof import("@/lib/supabase/server").createServerClient>,
  roomId: string,
  round: number
) {
  const { data: bots } = await db
    .from("players")
    .select("id")
    .eq("room_id", roomId)
    .eq("alive", true)
    .like("session_id", "bot:%") as { data: Array<{ id: string }> | null };

  if (!bots || bots.length === 0) return;

  const { data: subs } = await db
    .from("submissions")
    .select("id,player_id")
    .eq("room_id", roomId)
    .eq("round", round) as { data: Array<{ id: string; player_id: string }> | null };

  if (!subs || subs.length === 0) return;

  const { data: alreadyVoted } = await db
    .from("votes")
    .select("voter_id")
    .eq("room_id", roomId)
    .eq("round", round) as { data: Array<{ voter_id: string }> | null };

  const votedIds = new Set((alreadyVoted ?? []).map((v) => v.voter_id));
  const pending = bots.filter((b) => !votedIds.has(b.id));
  if (pending.length === 0) return;

  const votes = pending.map((b) => {
    const options = subs.filter((s) => s.player_id !== b.id);
    const target = options.length > 0
      ? options[Math.floor(Math.random() * options.length)]
      : subs[Math.floor(Math.random() * subs.length)];
    return { room_id: roomId, round, voter_id: b.id, submission_id: target.id };
  });

  await db.from("votes").insert(votes);
}

interface RoomRow {
  id: string; phase: string; round: number;
  deadline: string | null; write_sec: number;
  used_images: string[]; created_at: string;
  image_category: string | null; image_source: string | null;
  current_image: string | null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const sessionId = getSessionId(req);
  if (!sessionId) return err("MISSING_SESSION", "x-session-id required");

  const body = await req.json();
  const { phase: clientPhase, round: clientRound, force } = body as { phase: string; round: number; force?: boolean };

  const db = createServerClient();
  const isMissingCol = (e: unknown) => { const m = (e as { message?: string })?.message ?? ""; return m.includes("Could not find the") || m.includes("does not exist"); };

  const { data: initialRoom, error: roomErr } = await db
    .from("rooms")
    .select("id,phase,round,deadline,write_sec,used_images,created_at,image_category,image_source,current_image")
    .eq("code", code.toUpperCase())
    .single() as { data: RoomRow | null; error: unknown };

  let room = initialRoom;
  if (isMissingCol(roomErr)) {
    const fb = await db
      .from("rooms")
      .select("id,phase,round,deadline,write_sec,used_images,created_at,current_image")
      .eq("code", code.toUpperCase())
      .single() as { data: Omit<RoomRow, "image_category" | "image_source"> | null; error: unknown };
    room = fb.data ? { ...fb.data, image_category: null, image_source: null } : null;
  }

  if (!room) return err("ROOM_NOT_FOUND", "존재하지 않는 방입니다", 404);

  const nextPhaseMap: Record<string, string> = {
    WRITING: "VOTING",
    VOTING: "ROUND_RESULT",
    ROUND_RESULT: "WRITING", // 실제는 아래서 결정
  };

  const nextPhase = nextPhaseMap[clientPhase];
  if (!nextPhase) return ok({ advanced: false });

  // ROUND_RESULT → 다음 라운드 or GAME_OVER
  if (clientPhase === "ROUND_RESULT") {
    const { count: aliveCount } = await db
      .from("players").select("*", { count: "exact", head: true })
      .eq("room_id", room.id).eq("alive", true);

    // 봇만 남았는지 확인 — 인간이 0명이면 게임 종료
    const { count: humanAliveCount } = await db
      .from("players").select("*", { count: "exact", head: true })
      .eq("room_id", room.id).eq("alive", true)
      .not("session_id", "like", "bot:%");

    // 팀전: 생존 팀이 1개 이하이면 종료
    let teamGameOver = false;
    if (room.image_category !== undefined) { // 마이그레이션 적용 후에만 팀전 체크 (game_mode 컬럼 여부)
      const isMissingGM = (e: unknown) => { const m = (e as { message?: string })?.message ?? ""; return m.includes("Could not find the"); };
      const { data: gmData, error: gmErr } = await db
        .from("rooms").select("game_mode").eq("id", room.id).single() as { data: { game_mode: string } | null; error: unknown };
      if (!isMissingGM(gmErr) && gmData?.game_mode === "TEAM") {
        const { data: aliveTeamPlayers } = await db
          .from("players").select("team").eq("room_id", room.id).eq("alive", true) as { data: Array<{ team: string | null }> | null };
        const aliveTeams = new Set((aliveTeamPlayers ?? []).map((p) => p.team).filter(Boolean));
        teamGameOver = aliveTeams.size <= 1;
      }
    }

    const actualNext =
      teamGameOver || (aliveCount ?? 0) <= 1 || (humanAliveCount ?? 0) === 0
        ? "GAME_OVER"
        : "WRITING";
    const newRound = actualNext === "WRITING" ? clientRound + 1 : clientRound;
    const durSec = actualNext === "WRITING" ? room.write_sec : null;
    const deadline = durSec ? new Date(Date.now() + durSec * 1000).toISOString() : null;

    // 이미지 미리 선택 (WRITING으로 갈 때)
    let nextImage: { id: string; url: string } | null = null;
    let nextUsedImages = room.used_images;
    if (actualNext === "WRITING") {
      nextImage = await pickNextImage(db, room.used_images, room.image_category, room.image_source, code.toUpperCase());
      if (nextImage) nextUsedImages = [...room.used_images, nextImage.id];
    }

    let query = db
      .from("rooms")
      .update({
        phase: actualNext, round: newRound, deadline,
        ...(actualNext === "WRITING" ? { current_image: nextImage?.id ?? null, used_images: nextUsedImages } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("code", code.toUpperCase())
      .eq("phase", "ROUND_RESULT")
      .eq("round", clientRound);

    // 전체 동의 스킵이 아닐 때만 deadline 체크 (조기 전환 허용)
    if (!force) query = query.lte("deadline", new Date().toISOString());

    const { data: updated } = await query.select("id").maybeSingle() as { data: { id: string } | null };

    if (!updated) return ok({ advanced: false });

    await broadcast(roomChannel(code.toUpperCase()), "PHASE_CHANGED", { phase: actualNext, round: newRound, deadline });

    if (actualNext === "WRITING" && nextImage) {
      await broadcast(roomChannel(code.toUpperCase()), "IMAGE_REVEALED", { imageUrl: nextImage.url });
    }

    if (actualNext === "GAME_OVER") {
      await handleGameOver(db, room, code.toUpperCase(), clientRound);
    }

    return ok({ advanced: true });
  }

  // WRITING → VOTING
  if (clientPhase === "WRITING") {
    // Auto-submit for bots before phase changes (AI 제목 생성)
    await autoBotSubmit(db, room.id, clientRound, room.current_image);

    const deadline = new Date(Date.now() + 30000).toISOString();
    let writingQuery = db
      .from("rooms")
      .update({ phase: "VOTING", deadline, updated_at: new Date().toISOString() })
      .eq("code", code.toUpperCase())
      .eq("phase", "WRITING")
      .eq("round", clientRound);
    if (!force) writingQuery = writingQuery.lte("deadline", new Date().toISOString());
    const { data: updated } = await writingQuery.select("id").maybeSingle() as { data: { id: string } | null };

    if (!updated) return ok({ advanced: false });

    const { data: subs } = await db
      .from("submissions").select("id,title")
      .eq("room_id", room.id).eq("round", clientRound) as { data: Array<{ id: string; title: string }> | null };

    await broadcast(roomChannel(code.toUpperCase()), "PHASE_CHANGED", { phase: "VOTING", round: clientRound, deadline });
    await broadcast(roomChannel(code.toUpperCase()), "SUBMISSIONS_REVEALED", { submissions: shuffle(subs ?? []) });
    return ok({ advanced: true });
  }

  // VOTING → ROUND_RESULT
  if (clientPhase === "VOTING") {
    // Auto-vote for bots before phase changes
    await autoBotVote(db, room.id, clientRound);

    const deadline = new Date(Date.now() + 15000).toISOString();
    const { data: updated } = await db
      .from("rooms")
      .update({ phase: "ROUND_RESULT", deadline, updated_at: new Date().toISOString() })
      .eq("code", code.toUpperCase())
      .eq("phase", "VOTING")
      .eq("round", clientRound)
      .lte("deadline", new Date().toISOString())
      .select("id")
      .maybeSingle() as { data: { id: string } | null };

    if (!updated) return ok({ advanced: false });

    await broadcast(roomChannel(code.toUpperCase()), "PHASE_CHANGED", { phase: "ROUND_RESULT", round: clientRound, deadline });
    await computeAndBroadcastResult(code.toUpperCase(), clientRound);
    return ok({ advanced: true });
  }

  return ok({ advanced: false });
}

async function handleGameOver(
  db: ReturnType<typeof import("@/lib/supabase/server").createServerClient>,
  room: RoomRow,
  code: string,
  round: number
) {
  const { data: players } = await db
    .from("players").select("id,nickname,alive")
    .eq("room_id", room.id) as { data: Array<{ id: string; nickname: string; alive: boolean }> | null };

  const winners = (players ?? []).filter((p) => p.alive).map((p) => p.nickname);
  const durationSec = Math.round((Date.now() - new Date(room.created_at).getTime()) / 1000);

  const { data: result } = await db
    .from("game_results")
    .insert({ room_code: code, player_count: players?.length ?? 0, round_count: round, winners, duration_sec: durationSec, rematched: false })
    .select("id").single() as { data: { id: string } | null };

  // 각 라운드 베스트 제목을 highlights에 저장
  if (result) {
    const playerMap: Record<string, string> = {};
    for (const p of players ?? []) playerMap[p.id] = p.nickname;

    for (let r = 1; r <= round; r++) {
      const { data: subs } = await db
        .from("submissions").select("id,title,player_id")
        .eq("room_id", room.id).eq("round", r) as { data: Array<{ id: string; title: string; player_id: string }> | null };
      const { data: votesData } = await db
        .from("votes").select("submission_id")
        .eq("room_id", room.id).eq("round", r) as { data: Array<{ submission_id: string }> | null };

      if (!subs || subs.length === 0) continue;
      const counts: Record<string, number> = {};
      for (const v of votesData ?? []) counts[v.submission_id] = (counts[v.submission_id] ?? 0) + 1;

      const best = subs.reduce((a, b) => (counts[a.id] ?? 0) >= (counts[b.id] ?? 0) ? a : b);
      await db.from("highlights").insert({
        result_id: result.id,
        round: r,
        image_id: room.current_image ?? null,
        title: best.title,
        author: playerMap[best.player_id] ?? "?",
        votes: counts[best.id] ?? 0,
      });
    }
  }

  await broadcast(roomChannel(code), "GAME_OVER", { winners, resultId: result?.id ?? null });
}
