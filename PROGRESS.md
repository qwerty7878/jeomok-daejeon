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

## 다음 작업
- Supabase Storage 버킷 `room-images` 생성 (직접 이미지 업로드 기능 활성화)
- 브라우저 실제 UI 검증 (팀전 모드, 이미지 업로드, 어드민 페이지)
- (선택) 로비 Realtime 채널로 방 목록 실시간 업데이트

## 열린 질문
- (없음)
