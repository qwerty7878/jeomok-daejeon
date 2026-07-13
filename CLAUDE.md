# 그시절 — 제목학원

여러 명이 사진 하나를 보고 제목을 짓고, 서로 투표해서 최하위가 목숨을 잃는 실시간 파티 게임.
Vercel 서버리스 + Supabase. 끄투(KKuTu) 스타일 웹.

---

## 🚨 불변 규칙 (어길 시 즉시 중단)

1. **WebSocket 서버를 만들지 마라.** Vercel 서버리스에는 상주 프로세스가 없다.
   실시간은 **Supabase Realtime Broadcast**만 사용한다.
2. **`setTimeout`으로 라운드를 넘기지 마라.** 함수가 이미 죽어 있다.
   전이는 **Deadline 기반 Lazy Transition**(`docs/architecture.md`)으로만 한다.
3. **클라이언트가 Supabase 테이블을 직접 읽지 마라.** RLS 전면 차단이다.
   모든 읽기/쓰기는 `service_role` 키를 쓰는 **Next.js Route Handler 경유**.
4. **제출된 제목은 VOTING 전까지 절대 클라이언트로 나가지 않는다.**
   `SUBMIT_PROGRESS`는 숫자만 보낸다. 이걸 어기면 게임이 무너진다.
5. **VOTING phase 채팅은 서버에서 거부한다.** UI 차단만으로는 부족하다.
6. **저작권 있는 이미지를 쓰지 마라.** CC0 / Public Domain / 공공누리 1유형 / 자체 AI 생성만.
7. **DB 스키마·API·이벤트를 코드에서 즉흥적으로 바꾸지 마라.**
   `docs/schema.sql`, `docs/api.md`, `docs/events.md`가 **단일 진실**이다.
   변경이 필요하면 **문서를 먼저 고치고** 사용자 승인을 받는다.

---

## 📍 문서 라우팅 — 작업 전에 해당 문서를 Read 하라

| 작업 | 반드시 읽을 문서 |
|---|---|
| 무엇을 만들지 확인 | `docs/spec.md` |
| 화면 구현 / UI | `docs/pages.md` + `docs/design.md` |
| 게임 로직 / 상태 전이 | `docs/architecture.md` |
| DB 작업 | `docs/schema.sql` ★ |
| API 구현·호출 | `docs/api.md` ★ |
| Realtime 이벤트 | `docs/events.md` ★ |
| 이미지 수집·저작권 | `docs/content.md` |
| 테스트 | `docs/qa/testplan.md` |
| "왜 이렇게 했지?" | `docs/decisions/` |
| 지금 어디까지 됐지? | `PROGRESS.md` ★ |

★ = 세션 시작 시 항상 확인

> **이 파일에 스펙을 복붙하지 마라.** 여기는 라우터다. 내용은 `docs/`에 있다.

---

## 🧩 역할 분담 (subagent)

| 에이전트 | 언제 |
|---|---|
| `planner` | 스펙 변경, 기능 추가/삭제 판단, ADR 작성 |
| `backend` | Route Handler, Supabase, 게임 로직, 스키마 |
| `frontend` | Next.js 페이지, 컴포넌트, Realtime 구독, 끄투 UI |
| `qa` | DoD 검증, 테스트 작성, 치팅 시나리오 |
| `reviewer` | 커밋 전 읽기 전용 리뷰 |
| `curator` | 이미지 수집·라이선스 검증 |

**백엔드와 프론트는 서로의 코드를 읽지 않는다.** `docs/api.md` + `docs/events.md`라는 계약만 본다.
그래야 병렬로 굴릴 수 있다.

---

## 🛠 기술 스택 (변경 금지)

- Next.js 15 App Router / TypeScript / Tailwind
- Supabase (Postgres + Realtime Broadcast + Presence)
- Cloudflare R2 (이미지, egress 무료)
- `@vercel/og` (결과 카드 PNG)
- 배포: Vercel

## 명령어

```bash
pnpm dev            # 개발
pnpm typecheck      # ★ 커밋 전 필수
pnpm lint
pnpm test           # Vitest
pnpm test:e2e       # Playwright (멀티플레이 시나리오)
```

---

## ✅ 작업 완료 기준

작업이 "끝났다"고 말하기 전에:

1. `pnpm typecheck && pnpm lint` 통과
2. `docs/pages.md`의 해당 화면 **DoD 체크리스트를 전부 만족**
3. `PROGRESS.md` 갱신 (무엇을 했고, 다음은 무엇인지)
4. 스펙과 다르게 구현했다면 → **문서를 고치고 `docs/decisions/`에 이유를 남긴다**

## ❌ 하지 말 것

- 스펙에 없는 기능을 "있으면 좋을 것 같아서" 추가하지 마라. 물어봐라.
- 로그인/회원가입을 만들지 마라. 익명 `sessionId`만 쓴다.
- 게임 진행 상태를 Redis 없이 in-memory에 두지 마라. 서버리스는 상태가 없다.
- `localStorage`에 게임 상태를 두지 마라. `sessionId`와 `nickname`만 허용.

---

## 🔁 LOOP MODE (자율 루프로 실행 중일 때)

`scripts/loop.sh`로 실행되면 **사람이 없다.** 다음이 전부 바뀐다.

| 대화형 | 루프 |
|---|---|
| "물어봐라" | **`BLOCKED.md` 쓰고 종료** |
| "승인받아라" | **`BLOCKED.md` 쓰고 종료** |
| "완료했습니다" | **선언 금지.** `scripts/verify.sh` exit 0 만이 완료 |
| 스펙 수정 제안 | **금지.** BLOCKED |
| 여러 태스크 진행 | **금지.** `TASKS.md` 맨 위 TODO **하나만** |

### 🚨 부정행위 (하면 루프가 죽는다)
- `docs/` `tests/` `scripts/` `.claude/` 수정 — **verify가 감지해서 되돌린다**
- 테스트 skip / 주석 처리 / 삭제
- `any` `@ts-ignore` 로 타입 에러 덮기
- lint 규칙 끄기
- 스펙을 구현에 맞게 고치기

> 게이트를 통과하는 유일한 방법은 **올바르게 구현하는 것**이다.
> 못 하겠으면 BLOCKED다. BLOCKED는 실패가 아니다. **추측해서 잘못 만드는 것이 실패다.**

### 루프에서의 완료 정의
```
✅ ./scripts/verify.sh → exit 0
❌ "DoD를 만족했습니다" ← 이건 의견일 뿐
```
