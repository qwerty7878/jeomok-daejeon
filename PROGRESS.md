# PROGRESS

> 세션 간 인수인계 문서. **작업이 끝날 때마다 갱신한다.**
> 다음 세션의 Claude는 이 파일부터 읽는다.

## 현재 마일스톤
**M1 — 전체 UI 완성** (로비 + 게임방 + 결과)

## 상태

| 화면 | 상태 | 비고 |
|---|---|---|
| 공통 인프라 | ✅ 완료 | |
| P1 로비 | ✅ 완료 | `src/app/page.tsx` |
| P2 방 목록 | ✅ 완료 | 로비에 포함 |
| P3 방 만들기 | ✅ 완료 | 로비 내 모달 |
| P4 크레딧 | ✅ 완료 | `src/app/credits/page.tsx` |
| P5 대기실 | ✅ 완료 | `WaitingPhase.tsx` |
| P6 WRITING | ✅ 완료 | `WritingPhase.tsx` |
| P7 VOTING | ✅ 완료 | `VotingPhase.tsx` |
| P8 ROUND_RESULT | ✅ 완료 | `ResultPhase.tsx` |
| P9 GAME_OVER | ✅ 완료 | `GameOverPhase.tsx` |

## 지금까지 완료된 것

### 공통 인프라
- `src/lib/supabase/server.ts` — service_role 클라이언트
- `src/lib/supabase/client.ts` — anon 클라이언트 (Realtime 전용)
- `src/lib/broadcast.ts` — HTTP broadcast to Supabase Realtime
- `src/lib/api-helpers.ts` — err(), ok(), generateRoomCode(), getSessionId()
- `src/lib/game/transitions.ts` — computeAndBroadcastResult(), pickNextImage(), shuffle()
- `src/lib/utils.ts` — cn() (clsx + tailwind-merge)
- `src/types/database.ts` — Supabase DB 타입
- `src/types/game.ts` — Phase, RoomType, Player, RoomState 등

### Route Handlers (src/app/api/rooms/)
- `route.ts` — GET lobby list, POST create room
- `[code]/join/route.ts` — POST join
- `[code]/state/route.ts` — GET room snapshot
- `[code]/start/route.ts` — POST start game
- `[code]/submit/route.ts` — POST submit title
- `[code]/vote/route.ts` — POST vote
- `[code]/tick/route.ts` — POST lazy transition
- `[code]/chat/route.ts` — POST chat
- `[code]/sync/route.ts` — POST presence leave sync
- `[code]/rematch/route.ts` — POST rematch

### Frontend Hooks
- `src/hooks/useSession.ts` — useSyncExternalStore 기반
- `src/hooks/useGameRoom.ts` — Realtime 구독
- `src/hooks/useCountdown.ts` — 카운트다운

### UI Components (Classic-Modern, aged newsprint 테마)
- `src/components/ui/GameButton.tsx` — 그림자 있는 게임 버튼
- `src/components/ui/Modal.tsx` — 모달 공통 컴포넌트
- `src/components/ui/Hearts.tsx` — 목숨 하트 표시
- `src/components/ui/TimerBar.tsx` — 타이머 진행 바
- `src/components/ui/Toast.tsx` — (레거시, 현재 미사용)

### Game Components (새 디자인 적용)
- `src/components/game/PlayerList.tsx`
- `src/components/game/ChatPanel.tsx`
- `src/components/game/WritingPhase.tsx`
- `src/components/game/VotingPhase.tsx`
- `src/components/game/ResultPhase.tsx`
- `src/components/game/WaitingPhase.tsx`
- `src/components/game/GameOverPhase.tsx`

### Pages
- `src/app/page.tsx` — 로비 (방 목록, 방 만들기, 닉네임 모달)
- `src/app/credits/page.tsx` — 이미지 출처
- `src/app/join/[code]/page.tsx` — 초대 링크 리다이렉트
- `src/app/room/[code]/page.tsx` — 게임방 (PC 3패널 + 모바일 탭)
- `src/app/layout.tsx` — Gaegu + Gothic_A1 폰트, 뉴스프린트 테마
- `src/app/globals.css` — oklch 색상 토큰, 게임 애니메이션

### 디자인 시스템
- 색상: aged newsprint paper (배경), faded brick red (primary), petrol teal (secondary), aged mustard (accent)
- 폰트: Gaegu (손글씨체) + Gothic_A1 (고딕)
- 애니메이션: gs-pop, gs-shake, gs-wiggle, gs-heartbreak, gs-float-up

### 이미지
- 191장 CC0 이미지 Supabase DB에 시드 완료 (Met Museum)

### 빌드 상태
- `pnpm typecheck` ✅ 통과
- `pnpm lint` ✅ 통과 (경고만, 에러 0)
- `pnpm build` ✅ 통과

## 최근 변경 (2026-07-13)
- **봇 추가 기능**: `POST /api/rooms/[code]/bot` — 방장만 호출 가능, session_id = `bot:uuid` 패턴
- **봇 자동 플레이 (즉시 전환)**: 인간 전원 제출 시 봇 자동 제출 → VOTING 즉시 전환 (`submit/route.ts`)
- **봇 자동 투표 (즉시 전환)**: 인간 전원 투표 시 봇 자동 투표 → ROUND_RESULT 즉시 전환 (`vote/route.ts`)
- **tick**: 디드라인 기준 전환 + 봇 자동 플레이 (deadline 만료 시 폴백)
- **WaitingPhase**: 방장에게 "봇 추가" 버튼 표시
- **자동 입장**: 닉네임 저장돼 있으면 방 입장 시 모달 없이 바로 입장 (autoJoinRef 패턴)
- **제출 후 채팅 허용**: WRITING → submitted 상태에도 채팅 가능 (ChatPanel mySubmitted 연동)
- **내 제목 투표 차단**: VotingPhase에서 mySubmissionId 비교로 처음부터 disabled
- **체크마크 표시**: PlayerList에서 제출/투표 완료자에 체크 아이콘 표시
- **결과 스킵**: ROUND_RESULT에서 전원 동의 시 즉시 다음 라운드 (`SKIP_READY` 이벤트 + force tick)
- **관전자(탈락자)**: 리액션 버튼 + 심사위원 투표 가능 (SPECTATOR 상태 분기)
- **리액션 시스템**: `POST /api/rooms/[code]/reaction` + `ReactionBar` + `ReactionOverlay` 부유 이모지
- **사이드바 높이**: `h-[calc(100dvh-3.5rem)]` 고정으로 스크롤 없이 맞춤
- **로비 태그라인 제거**, **버튼 색상 조정**, **여백 최소화**
- **이미지 표시**: `next/image fill + object-contain` (짤림 없음)
- `pnpm typecheck` ✅ | `pnpm lint` ✅ (에러 0, 경고 3 — 테스트 파일만)

## 전체 사이클 API 테스트 결과 (2026-07-13)
- WRITING → 제출 → VOTING 즉시 전환 ✅
- VOTING → 투표 → ROUND_RESULT 즉시 전환 ✅
- ROUND_RESULT → tick → WRITING 2라운드 ✅
- 2라운드 제출 정상 동작 ✅

## 최근 변경 (2026-07-14 — 기능 완성 + 테스트)

### 신규 기능 (#7~#10) — 코드 완성 + DB 마이그레이션 적용 완료

- **#7 이미지 카테고리 선택**: `rooms.image_category` 컬럼 추가. 로비 방 만들기 모달에 카테고리 선택 UI. `pickNextImage`에서 category 필터 적용
- **#8 직접 이미지 업로드**: `POST/GET/DELETE /api/rooms/[code]/images`. Supabase Storage `room-images` 버킷. CUSTOM 모드 전용 (5MB, JPEG/PNG/WebP/GIF, 최대 20장). WaitingPhase에 업로드 UI
- **#9 팀전 모드**: `rooms.game_mode`, `players.team` 컬럼 추가. 시작 시 자동 팀 배정 (A/B). 팀 득표 합산 → 낮은 팀 전원 생명 차감. WaitingPhase에 팀 뱃지 표시
- **#10 어드민 페이지 + 신고 기능**: `reports` 테이블. `POST /api/report`, `GET/PATCH/POST /api/admin/reports`. `/admin` 페이지 (비밀번호 게이트 + 신고 관리 + 방 현황)
- **ChatPanel 신고 버튼**: 메시지 hover 시 Flag 아이콘, 신고 후 빨간색 비활성화
- **로비 숨은 어드민 링크**: hover 시만 보이는 `·` 링크
- **DB 마이그레이션**: `migrations/001_new_features.sql` 작성 + Supabase 적용 완료

### 버그 수정

- `transitions.ts`: `team` 컬럼 미존재 시 `alivePlayers` 쿼리가 null을 반환해 생명 차감이 안 되던 버그 수정 (fallback 쿼리 추가)
- `tick/route.ts`: WRITING → VOTING에 `force` 옵션 추가 (테스트 편의 + 조기 전환 지원)
- `prefer-const` lint 에러 수정 (start/route.ts, tick/route.ts, transitions.ts)

### 전체 게임 플로우 API 테스트 결과 (2026-07-14)

- 방 생성 (gameMode/imageCategory 저장) ✅
- 3명 입장 → 시작 (WRITING) ✅
- 3명 제출 → VOTING 즉시 전환 ✅
- 3명 투표 → ROUND_RESULT 즉시 전환 ✅
- 생명 차감 (최하위 득표자, 미제출자) ✅
- ROUND_RESULT → WRITING (다음 라운드) ✅
- 전원 생명 소진 → GAME_OVER ✅
- 신고 API (중복 방지 409) ✅
- 어드민 API (통계, 신고 목록) ✅

### 빌드 상태 (2026-07-14)
- `pnpm typecheck` ✅ 에러 0
- `pnpm lint` ✅ 에러 0, 경고 3 (기존 테스트 파일)

## 최근 변경 (2026-07-13 — 서비스 출시 준비)
- **시청자 채팅 구분**: CHAT 이벤트에 `alive` 필드 추가, ChatPanel에서 관전 뱃지 + 흐린 색상으로 표시
- **결과 카드 공유**: `GET /api/og/result/[id]` — @vercel/og로 OG 이미지 생성. GameOverPhase에 "결과 공유" 버튼 (Web Share API / clipboard 폴백)
- **방 자동 삭제**: `GET /api/cron/cleanup` — WAITING 2시간 / GAME_OVER 1시간 경과 방 삭제. `vercel.json`에 매 시간 cron 등록. 삭제 전 ROOM_CLOSED broadcast
- **ROOM_CLOSED 처리**: useGameRoom에서 수신 시 로비로 자동 리다이렉트
- **사이드바 높이 고정**: `aside`에 `h-full overflow-hidden` 추가로 화면 밖 넘침 방지
- **이미지 프리로드**: IMAGE_REVEALED 수신 시 `new Image().src` 로 브라우저 캐시 워밍
- **봇 자동 투표 즉시 전환**: vote/route.ts 인간 전원 투표 감지 + 봇 자동 투표 후 즉시 ROUND_RESULT
- **GAME_OVER 조건 수정**: `aliveCount ≤ 1 OR humanAliveCount = 0` (봇만 남으면 종료)
- **동점 처리**: 전원 동점 시 랜덤 1명만 목숨 감소 (1:1 무한 반복 방지)
- **로비 필터**: phase = WAITING 방만 표시

## 배포 체크리스트
- [ ] Vercel 환경변수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `ADMIN_SECRET`
- [ ] Supabase 프로덕션 DB에 `docs/schema.sql` 적용 (개발 DB: `migrations/001_new_features.sql` 이미 적용됨)
- [ ] Supabase Storage 버킷 `room-images` 생성 (직접 이미지 업로드용)
- [ ] Supabase 이미지 191장 시드 (`docs/content.md` 참고)
- [ ] Supabase Realtime → Broadcast 채널 활성화
- [ ] Vercel Pro (cron은 Pro 이상 필요)

## 최근 변경 (2026-07-14 — 이미지 스토리지 정리 + 어드민 라이브러리 업로드)

배경: `docs/spec.md`는 이미지 저장소로 Cloudflare R2를 지정하고 있었지만, 실제 커스텀 업로드(`#8`)는
이미 Supabase Storage(`room-images` 버킷)로 구현돼 있었음 — 문서와 코드 불일치 발견. R2를 새로 들이는 대신
Supabase Storage로 통일하기로 결정 ([ADR 002](docs/decisions/002-supabase-storage-not-r2.md)).

- **커스텀 업로드 고아 파일 버그 수정**: `GET /api/cron/cleanup`이 방을 삭제할 때 `images` row는 FK CASCADE로
  같이 지워지고 있었지만, `room-images` storage의 실제 파일은 안 지워지고 있었음. cleanup 시 `room-images/{code}/`
  하위 파일을 함께 삭제하도록 수정 — "경기 전용, 서버에 영구 보관 안 함" 요구사항을 실제로 보장
- **어드민 라이브러리 업로드 (AD-04) 신규 구현**: `POST/GET/PATCH /api/admin/images`. `library-images` 버킷
  (공용, `room_id = NULL`, 영구 자산). `source`/`license`/`source_url` 필수 검증 (`docs/content.md` 출처표시 의무).
  `/admin` 페이지에 "이미지" 탭 추가 — 업로드 폼 + 썸네일 그리드 + 활성/비활성 토글
- **문서 갱신**: `docs/api.md`(신규 엔드포인트 4종), `docs/spec.md`(기술 스택 표, 파이프라인 다이어그램),
  `docs/pages.md`(AD-04) — R2 → Supabase Storage로 정정. `docs/spec.md`의 "정기 작업 = pg_cron" 표기도
  실제 구현(Vercel Cron)에 맞게 정정

### 빌드 상태 (2026-07-14, 최신)
- `pnpm typecheck` ✅ 에러 0
- `pnpm lint` ⚠️ **미검증** — 이 개발 환경(로컬 Mac)에서 `eslint`가 `@typescript-eslint/eslint-plugin`
  모듈 로딩 중 무한정 멈추는 문제 발생 (터미널에서 직접 실행해도 재현됨). `node -e "require(...)"` 단일 파일 테스트로
  격리해봐도 동일하게 멈추고, `sample`로 스택 채집 시 커널 `read`/`kevent`에서 블록 — Node의 모듈 로딩 시점에
  파일 I/O가 응답을 안 받는 상태. 프로세스 목록엔 서드파티 백신 없이 macOS 기본 `amfid`/`syspolicyd`/`XprotectService`만
  있어 macOS 자체 코드 서명 검증(Gatekeeper) 관련 로컬 이슈로 추정 — 이 프로젝트 코드 문제는 아님
  (`pnpm typecheck`는 같은 `node_modules`로 정상 통과).
  변경된 파일(`src/app/api/cron/cleanup/route.ts`, `src/app/api/admin/images/route.ts`, `src/app/admin/page.tsx`)은
  수동으로 리뷰해서 미사용 import·hooks 의존성 배열·JSX 이스케이프 등 흔한 lint 이슈는 없음을 확인함.
  **다음 세션에서 `pnpm lint`가 정상 동작하면 반드시 재검증할 것.**

## 최근 변경 (2026-07-14 — 팀전 대기실 표시 + 방 만들기 모달 반응형 수정)

배경: 사용자 리포트 2건 — (1) 팀전(TEAM) 모드인데 대기실에서 개인전과 똑같아 보임, 팀 구분이 전혀 안 보임
(2) 방 만들기 모달이 반응형이 아닌 듯 화면이 잘림.

- **팀 배정 시점을 시작(`/start`) → 입장(`/join`, `/bot`)으로 이동**: 기존엔 방장이 "게임 시작"을 눌러야만
  서버가 팀을 셔플 배정했음 — 그 전까진 `players.team`이 전부 null이라 대기실 UI가 이미 있었어도(WaitingPhase.tsx)
  표시할 데이터가 없었음. `join`/`bot` 라우트에서 입장 즉시 인원 적은 팀에 배정하도록 수정.
  `start/route.ts`는 이제 재배정하지 않고 누락분만 방어적으로 채움 — 대기 중 보여준 팀과 실제 게임 팀이 달라지는 걸 방지
- **WaitingPhase 팀 UI를 카트라이더 스타일 2컬럼으로 재설계**: 기존엔 한 줄에 뒤섞인 뱃지였음 →
  팀 A(파랑)/팀 B(빨강) 카드를 나란히 배치, 각 팀 인원수 + 명단 표시 (`TeamColumn` 컴포넌트)
- **`team` 필드 broadcast 누락 수정**: `nickname`/`sync`/`rematch` 라우트가 `PLAYER_UPDATE` 브로드캐스트 시
  `team`을 안 보내고 있어서, 닉네임 변경·재연결·한 판 더 이후 클라이언트에서 팀 표시가 사라지는 문제가 있었음
  (전체 players 배열을 통째로 교체하는 구조라 누락 필드가 기존 값을 덮어씀) — 전부 `team` 포함하도록 수정
- **`Modal.tsx` 공통 컴포넌트에 `max-h-[85dvh] overflow-y-auto` 추가**: 필드가 많은 방 만들기 모달이
  화면보다 커지면 잘려서 아래쪽(제출 버튼 포함)이 안 보이던 문제 수정. 공통 컴포넌트라 모든 모달에 적용됨
- 문서 갱신: `docs/api.md`(Player.team 필드, `/start` 팀 배정 시점 변경 설명), `docs/pages.md`(WT-11 팀 분할 항목 신규 — 기존에 팀전 자체가 스펙 문서에 없었음)

### 빌드 상태 (2026-07-14, 이 변경분)
- `pnpm typecheck` ✅ 에러 0
- `pnpm lint` ⚠️ 여전히 미검증 (같은 로컬 환경 이슈, 위 항목 참고). 변경 파일 수동 리뷰 완료 —
  신규 import 없음, `let`/`const` 적절히 사용, 미사용 변수 없음

## 최근 변경 (2026-07-17 — 애드센스 투명성 페이지 추가)

배경: Google AdSense 프로그램 정책이 요구하는 "소개"·"문의하기" 페이지가 없었음 (개인정보처리방침에 이메일만
9번 항목에 묻혀 있었음). `docs/pages.md`에 P14/P15로 스펙을 먼저 추가한 뒤 구현.

- **`/about` 소개 페이지 신규**: 서비스 설명, 운영 목적(비상업 개인 프로젝트, 광고 게재 사실 고지),
  이용 방식(로그인 없음), 이미지 출처·문의하기 링크
- **`/contact` 문의하기 페이지 신규**: 개인정보처리방침에 묻혀 있던 이메일 문의처를 독립 페이지로 분리.
  `mailto:` 링크만 사용 (서버리스 이메일 발송 인프라 없음 — 백엔드 폼 미구현)
- **로비 푸터 갱신**: 소개 / 이미지 출처 / 개인정보처리방침 / 문의하기 4개 링크로 확장 (기존엔 2개)
- **`sitemap.ts`/`robots.ts` 갱신**: `/about`, `/contact` 추가
- **개인정보처리방침 9번 항목**: `/contact` 페이지로 상호 링크 추가

### 검증 (2026-07-17)
- `pnpm typecheck` ✅ 에러 0
- `pnpm lint` ✅ 에러 0, 경고 4 (전부 기존 파일 — `layout.tsx`의 미사용 `Script` import, 테스트 파일 3곳. 이번 변경분과 무관)
- `pnpm dev` 로 실제 기동 후 curl 검증: `/about` `/contact` `/privacy` 모두 200, 타이틀·본문 정상 렌더링,
  로비 푸터 4개 링크 정상, `/sitemap.xml`·`/robots.txt`에 신규 경로 반영 확인
- `pnpm build`: Turbopack 컴파일은 성공하지만 마지막 TypeScript 단계에서
  `Definitions of the following identifiers conflict with those in another file: unstable_cache, ...` 에러로 실패.
  **원인은 이번 변경과 무관** — Next.js가 워크스페이스 루트를 `/Users/annhyeonjune/package-lock.json`(홈 디렉터리,
  이 프로젝트 바깥)으로 오탐지해서 동일 머신의 다른 프로젝트(`~/Desktop/fanboard`)의 `next` 타입 선언과 충돌하는
  로컬 환경 문제. `pnpm typecheck`(플레인 `tsc --noEmit`)는 정상 통과함. 이 프로젝트의 완료 기준은
  `pnpm typecheck && pnpm lint`이며 둘 다 통과했음. **Vercel 배포 빌드는 격리된 환경이라 이 문제와 무관할
  가능성이 높지만, 다음 세션에서 로컬 `pnpm build`가 여전히 실패하면 `next.config.ts`에
  `turbopack.root`를 명시해서 근본 원인을 없앨 것.**

## 다음 작업
- 로컬 `pnpm build`의 workspace-root 오탐지 문제 — `next.config.ts`에 `turbopack.root` 명시해서 해결 (위 항목 참고)
- `pnpm lint` 재시도 (재부팅 등으로 macOS Gatekeeper 이슈 해소된 뒤) — **이번 세션의 모든 변경분 포함해서 최종 검증 필요**
- 브라우저 실제 UI 검증: 팀전 방 만들어서 2명 이상 입장 시 대기실에 팀 A/B 컬럼 분리 확인, 방 만들기 모달을 작은 화면에서 스크롤 확인
- `/admin` 이미지 탭 업로드 플로우, cleanup cron의 storage 삭제 동작
- Vercel 배포 환경에 `library-images` 버킷 사전 생성 여부 확인 (코드는 없으면 자동 생성 시도함)
- (선택) 로비 Realtime 채널로 방 목록 실시간 업데이트
- (선택) 애드센스 "다양한 형식의 콘텐츠" 요건 대응 — 게임 자체는 인터랙티브 툴이라 기사/동영상형 콘텐츠가 약함.
  명예의 전당(`/hall-of-fame`)이 유일한 콘텐츠성 페이지. 필요시 논의 후 확장

## 열린 질문
- (없음)
