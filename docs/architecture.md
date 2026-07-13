# 아키텍처

> `docs/spec.md` §1~§2를 여기로 발췌. 게임 로직 작업 시 필수.

## 데이터 흐름

```
[Client] ──HTTP──► [Next.js Route Handler]  ← 게임 로직 권위 (service_role)
   ▲                        │
   │                        ├─► Supabase Postgres (상태)
   │                        └─► Supabase Realtime Broadcast (알림)
   │                                    │
   └────────────── 구독(읽기전용) ────────┘
```

**클라이언트는 DB를 직접 만지지 않는다.** RLS 전면 차단(정책 없음).

## Deadline Lazy Transition ★

→ `docs/decisions/001-serverless-lazy-transition.md`

```
1. 라운드 시작:  phase='WRITING', deadline = now() + write_sec
2. 클라: deadline에서 카운트다운 렌더링 (표시만)
3. deadline 도달 → 아무나 POST /tick
4. 서버: 조건부 UPDATE → 1 row 딴 요청만 승자 → Broadcast
5. 나머지는 0 rows → no-op (멱등)
```

**조기 전이**: `/submit` 핸들러가 `제출수 === 생존자수` 확인 → 같은 조건부 UPDATE로 즉시 전이.

## 상태 머신

```
WAITING ──시작(3명↑)──► WRITING ──► VOTING ──► ROUND_RESULT
   ▲                                              │
   │                          ┌── 생존 2명↑ ───────┤
   │                          │              생존 1명↓
   └──한 판 더── GAME_OVER ◄───┘                   │
                    ▲──────────────────────────────┘
```

## 무료 티어 한계
- **Supabase Realtime 동시 200 연결** = 약 25개 방. 이게 하드 리밋이다.
- 초과 시 신규 방 생성 차단 + 안내.
