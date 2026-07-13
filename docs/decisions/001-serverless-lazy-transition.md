# ADR 001 — Deadline 기반 Lazy Transition

## 상태
채택

## 맥락
Vercel 서버리스에는 상주 프로세스가 없다. "45초 뒤 라운드 종료"를 실행할 주체가 없다.

## 대안
1. 별도 게임 서버 상시 구동 → **비용 발생. 기각**
2. Vercel Cron → **Hobby는 하루 1회 제한. 기각**
3. Supabase pg_cron 초단위 → **최소 주기 1분. 기각**
4. 클라이언트가 전이를 트리거 → **채택**

## 결정
`rooms.deadline`을 DB에 저장한다.
클라이언트가 deadline 도달 시 `POST /tick`을 쏜다.
서버는 조건부 UPDATE로 전이한다:

```sql
UPDATE rooms SET phase = $next, deadline = now() + $dur
 WHERE code = $1 AND phase = $2 AND round = $3 AND deadline <= now();
```

N명이 동시에 쏴도 **DB 원자성이 정확히 1명만 통과**시킨다. 나머지는 0 rows → no-op.

## 결과
- ✅ 상주 서버 없이 서버 권위 유지
- ✅ 클라 시계 조작 불가 (`deadline <= now()`를 DB가 검증)
- ⚠️ 전원이 브라우저를 닫으면 방이 멈춤 → pg_cron 5분 주기 정리로 보완
- ⚠️ **`tick` 원자성 테스트가 필수** — 이게 깨지면 라운드가 두 번 넘어간다
