#!/usr/bin/env bash
# 루프 드라이버.
# 매 이터레이션마다 **새 세션**을 띄운다. --continue 쓰지 않는다.
# 컨텍스트는 TASKS.md / PROGRESS.md / docs/ 가 들고 있다.
set -uo pipefail

MAX_ITER="${MAX_ITER:-20}"
MAX_RETRY=3

for i in $(seq 1 "$MAX_ITER"); do
  echo "════════ ITERATION $i / $MAX_ITER ════════"

  # 사람 개입이 필요하면 즉시 정지
  if [ -s BLOCKED.md ]; then
    echo "🛑 BLOCKED. 사람이 필요하다:"; cat BLOCKED.md; exit 2
  fi

  # 남은 태스크가 없으면 종료
  if ! grep -q '^\- \[ \] TODO' TASKS.md; then
    echo "🎉 모든 태스크 완료"; exit 0
  fi

  # ── 1) 구현 (fresh context) ──
  claude -p "/next-task" --permission-mode acceptEdits

  # ── 2) 독립 검증 ★ 에이전트의 주장을 믿지 않는다 ──
  attempt=1
  until ./scripts/verify.sh; do
    if [ "$attempt" -ge "$MAX_RETRY" ]; then
      echo "❌ $MAX_RETRY회 실패 → BLOCKED"
      claude -p "/give-up 방금 태스크가 verify를 3회 실패했다. BLOCKED.md에 원인과 시도한 것을 기록하고, TASKS.md의 해당 태스크를 BLOCKED로 바꿔라. 코드는 고치지 마라."
      git reset --hard HEAD   # 실패한 작업 폐기
      exit 2
    fi
    echo "🔁 verify 실패 → 수정 시도 $attempt/$MAX_RETRY"
    claude -p "/fix-verify" --permission-mode acceptEdits
    attempt=$((attempt+1))
  done

  # ── 3) 통과했을 때만 커밋 ──
  git add -A && git commit -m "loop: $(grep -m1 'DOING' TASKS.md || echo 'task')" || true
  echo "✅ iteration $i 통과"
done

echo "⏹ MAX_ITER 도달. 사람이 확인할 것."
