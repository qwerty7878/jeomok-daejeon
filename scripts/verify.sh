#!/usr/bin/env bash
# 이것이 "완료"의 유일한 정의다.
# 에이전트의 자기 보고를 믿지 않는다. exit 0 만이 통과다.
set -euo pipefail

echo "▸ typecheck"; pnpm typecheck
echo "▸ lint";      pnpm lint

echo "▸ 게이트 무결성 검사 ★"
# 에이전트가 테스트/스펙을 고쳐서 통과시키는 것을 물리적으로 차단
if ! git diff --quiet HEAD -- tests/ docs/ scripts/ .claude/; then
  echo "❌ FATAL: worker가 tests/ docs/ scripts/ .claude/ 를 수정했다."
  echo "   게이트를 고쳐서 통과하는 것은 금지다. 변경을 되돌린다."
  git checkout HEAD -- tests/ docs/ scripts/ .claude/
  exit 1
fi

echo "▸ unit + integration"; pnpm test --run
echo "▸ 치팅 시나리오 C1~C8"; pnpm test --run tests/cheating.test.ts
echo "▸ 레이스 R1~R7";       pnpm test --run tests/race.test.ts
echo "▸ e2e (멀티플레이)";    pnpm test:e2e

echo "✅ VERIFY PASS"
