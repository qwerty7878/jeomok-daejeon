/**
 * T003/T004 검증: 채점 로직
 *
 * - 동점 전원 목숨 -1
 * - 미제출자 자동 최하위
 * - 전원 미제출 → 라운드 무효 (목숨 차감 없음)
 * - 마지막 2명 동시 탈락 → 공동 우승
 */
import { describe, it, expect } from "vitest";

// 채점 로직을 순수 함수로 추출해서 단위 테스트
// 실제 DB 없이 로직만 검증

interface Submission {
  id: string;
  player_id: string;
  title: string;
}

interface VoteCount {
  [submissionId: string]: number;
}

interface Player {
  id: string;
  lives: number;
  alive: boolean;
}

function computeResult(
  submissions: Submission[],
  voteCounts: VoteCount,
  alivePlayers: Player[]
): {
  ranking: Array<{ id: string; player_id: string; votes: number }>;
  toDeductPlayerIds: string[];
  isVoidRound: boolean;
} {
  const submittedPlayerIds = new Set(submissions.map((s) => s.player_id));
  const nonSubmitterIds = alivePlayers
    .filter((p) => p.alive && !submittedPlayerIds.has(p.id))
    .map((p) => p.id);

  const ranking = submissions
    .map((s) => ({ id: s.id, player_id: s.player_id, votes: voteCounts[s.id] ?? 0 }))
    .sort((a, b) => b.votes - a.votes);

  // 전원 미제출 or 아무도 투표 안 함 → 무효 라운드
  const totalVotes = Object.values(voteCounts).reduce((s, v) => s + v, 0);
  if (submissions.length === 0 || totalVotes === 0) {
    return { ranking, toDeductPlayerIds: [], isVoidRound: true };
  }

  const minVotes = Math.min(...ranking.map((r) => r.votes));
  const loserPlayerIds = ranking
    .filter((r) => r.votes === minVotes)
    .map((r) => r.player_id);

  const toDeductPlayerIds = [...new Set([...loserPlayerIds, ...nonSubmitterIds])];

  return { ranking, toDeductPlayerIds, isVoidRound: false };
}

describe("채점 로직", () => {
  const players: Player[] = [
    { id: "p1", lives: 3, alive: true },
    { id: "p2", lives: 3, alive: true },
    { id: "p3", lives: 3, alive: true },
  ];

  it("정상 케이스: 최하위 1명만 차감", () => {
    const subs: Submission[] = [
      { id: "s1", player_id: "p1", title: "A" },
      { id: "s2", player_id: "p2", title: "B" },
      { id: "s3", player_id: "p3", title: "C" },
    ];
    const votes: VoteCount = { s1: 2, s2: 1, s3: 0 };
    const { toDeductPlayerIds } = computeResult(subs, votes, players);
    expect(toDeductPlayerIds).toEqual(["p3"]); // 0표
  });

  it("동점 최하위: 전원 차감", () => {
    const subs: Submission[] = [
      { id: "s1", player_id: "p1", title: "A" },
      { id: "s2", player_id: "p2", title: "B" },
      { id: "s3", player_id: "p3", title: "C" },
    ];
    const votes: VoteCount = { s1: 2, s2: 0, s3: 0 };
    const { toDeductPlayerIds } = computeResult(subs, votes, players);
    expect(toDeductPlayerIds.sort()).toEqual(["p2", "p3"].sort());
  });

  it("미제출자 자동 최하위 포함", () => {
    const subs: Submission[] = [
      { id: "s1", player_id: "p1", title: "A" },
      { id: "s2", player_id: "p2", title: "B" },
      // p3 미제출
    ];
    const votes: VoteCount = { s1: 2, s2: 1 };
    const { toDeductPlayerIds } = computeResult(subs, votes, players);
    expect(toDeductPlayerIds).toContain("p3"); // 미제출 → 자동 최하위
  });

  it("전원 미제출 → 라운드 무효 (차감 없음)", () => {
    const { toDeductPlayerIds, isVoidRound } = computeResult([], {}, players);
    expect(isVoidRound).toBe(true);
    expect(toDeductPlayerIds).toHaveLength(0);
  });

  it("아무도 투표 안 함 → 라운드 무효", () => {
    const subs: Submission[] = [
      { id: "s1", player_id: "p1", title: "A" },
    ];
    const { isVoidRound } = computeResult(subs, {}, players);
    expect(isVoidRound).toBe(true);
  });

  it("공동 우승: 마지막 2명 동시 탈락", () => {
    const last2: Player[] = [
      { id: "p1", lives: 1, alive: true },
      { id: "p2", lives: 1, alive: true },
    ];
    const subs: Submission[] = [
      { id: "s1", player_id: "p1", title: "A" },
      { id: "s2", player_id: "p2", title: "B" },
    ];
    const votes: VoteCount = { s1: 1, s2: 1 }; // 동점 → 둘 다 -1 → 둘 다 0 → 공동 우승
    const { toDeductPlayerIds } = computeResult(subs, votes, last2);

    // 둘 다 차감 → lives 0 → alive=false → 공동 우승
    const after = last2.map((p) => ({
      ...p,
      lives: p.lives - (toDeductPlayerIds.includes(p.id) ? 1 : 0),
    }));
    const survivors = after.filter((p) => p.lives > 0);
    expect(survivors).toHaveLength(0); // 생존자 0 → 공동 우승
    expect(toDeductPlayerIds.sort()).toEqual(["p1", "p2"].sort());
  });
});
