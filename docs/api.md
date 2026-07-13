# API 계약 (SSOT)

> **이 문서가 진실이다.** 코드가 다르면 코드가 틀린 것이다.
> 백엔드와 프론트는 서로의 코드가 아니라 이 문서를 본다.
> 변경하려면 문서를 먼저 고치고 사용자 승인을 받는다.

## 공통

- 모든 요청 헤더: `x-session-id: {uuid}`
- 에러 응답: `{ error: { code: string, message: string } }`
- 에러 코드: `ROOM_NOT_FOUND` `ROOM_FULL` `WRONG_PASSWORD` `PASSWORD_COOLDOWN`
  `NOT_HOST` `NOT_ENOUGH_PLAYERS` `DEADLINE_PASSED` `PHASE_MISMATCH`
  `CANNOT_VOTE_SELF` `ALREADY_VOTED` `CHAT_LOCKED` `RATE_LIMITED`

---

## POST /api/rooms
방 생성.

```ts
// req
{ name: string, maxPlayers: 3..12, roomType: 'PUBLIC'|'LOCKED'|'SECRET',
  password?: string /* 4자리, LOCKED 필수 */, lives: 2..5, writeSec: 30|45|60 }
// res 201
{ code: string /* 6자, 0 O 1 I 제외 */, inviteToken: string }
```

## GET /api/rooms
로비 목록. `PUBLIC` + `LOCKED`만. **`SECRET` 제외.**

```ts
{ rooms: Array<{
    code, name, roomType: 'PUBLIC'|'LOCKED',
    playerCount, maxPlayers,
    status: 'WAITING'|'PLAYING'|'FULL'
  }> }
```

## POST /api/rooms/[code]/join
입장. **토큰이 유효하면 비번 검증을 생략한다.**

```ts
// req
{ nickname: string, password?: string, inviteToken?: string }
// res 200
{ playerId: string, asSpectator: boolean }
// 400 WRONG_PASSWORD    → { attemptsLeft: number }
// 429 PASSWORD_COOLDOWN → { retryAfterSec: number }   // 5회 실패 시 60초
```

## GET /api/rooms/[code]/state
**전체 스냅샷. 재접속 복원의 전부.**

```ts
{
  room: { code, name, roomType, phase, round, deadline /* ISO */,
          lives, writeSec, maxPlayers, hostId },
  players: Array<{ id, nickname, lives, alive, connected, isHost, team?: 'A'|'B'|null }>,
  me: { playerId, alive, submitted: boolean, voted: boolean },
  image?: { url },                       // WRITING 이후
  submissions?: Array<{ id, title }>,    // VOTING 이후. 작성자 없음
  result?: {                             // ROUND_RESULT 일 때만
    ranking: Array<{ id, title, author, votes }>,
    eliminated: string[]
  }
}
```
> ⚠️ `phase === 'WRITING'`이면 `submissions`를 **절대 포함하지 않는다.**

## POST /api/rooms/[code]/start
방장만. 생존 3명 미만이면 `NOT_ENOUGH_PLAYERS`.
`game_mode === 'TEAM'`이어도 여기서 팀을 (재)배정하지 않는다 — 팀은 입장(`join`)·봇 추가(`bot`) 시점에
인원이 적은 쪽으로 즉시 배정되어 대기실부터 노출된다. 대기 중 보여준 팀 구성과 실제 게임이 달라지면 안 되기 때문.
누락된 팀만 방어적으로 채운다.

## POST /api/rooms/[code]/submit
```ts
{ round: number, title: string /* ≤40자 */ }
```
- 서버가 `phase === 'WRITING' && deadline > now()` 검증 → 아니면 `DEADLINE_PASSED`
- 재제출 = 덮어쓰기 (`UNIQUE(room_id, round, player_id)`)
- **제출 후 `제출수 === 생존자수`면 즉시 VOTING 조기 전이**

## POST /api/rooms/[code]/vote
```ts
{ round: number, submissionId: string }
```
- `submission.player_id === me` → `CANNOT_VOTE_SELF`
- **관전자도 투표 가능**
- 전원 투표 시 즉시 ROUND_RESULT

## POST /api/rooms/[code]/tick ★ 아키텍처의 심장
`deadline` 도달 시 **아무 클라이언트나** 호출. **멱등.**

```ts
// req
{ phase: string, round: number }   // 클라가 알고 있는 현재 상태
// res 200
{ advanced: boolean }              // 내가 전이 승자였나 (UI엔 영향 없음)
```

서버 동작:
```sql
UPDATE rooms SET phase = $next, deadline = now() + $dur
 WHERE code = $1 AND phase = $2 AND round = $3 AND deadline <= now();
-- 1 row → 전이 성공 → Broadcast 발행
-- 0 row → 이미 누가 했음 → 조용히 무시 (에러 아님)
```

## POST /api/rooms/[code]/chat
```ts
{ message: string /* ≤100자 */ }
```
- **`phase === 'VOTING'` → `CHAT_LOCKED` (403).** ★ 서버에서 반드시 막는다
- `phase === 'WRITING'` → 미제출자는 `CHAT_LOCKED`
- Rate limit: 초당 1회

## POST /api/rooms/[code]/sync
Presence leave 감지 시 호출. 30초 유예 후 이탈 확정.

## POST /api/rooms/[code]/rematch
참가자 유지, 목숨 리셋, `WAITING` 복귀. **`한 판 더` 클릭률을 계측한다.**

## GET /api/og/result/[resultId]
1200×630 PNG. `@vercel/og`. **한글 폰트 임베드 필수** (Satori는 폰트를 직접 넣어야 함).

---

## POST /api/rooms/[code]/images
방장이 대기실(`WAITING`)에서 커스텀 이미지 업로드. `room.image_source === 'CUSTOM'`일 때만.
`multipart/form-data`: `file` (jpg/png/webp/gif, ≤5MB). 방당 최대 20장.
Supabase Storage `room-images` 버킷에 `{code}/{ts}.{ext}`로 저장, `images.room_id = code`로 등록.
**이 경기 전용.** 방이 cleanup(★ `POST /api/cron/cleanup` 참고)으로 삭제되면 storage 파일도 함께 삭제된다 — 영구 보관 아님.
```ts
// res 201
{ id: string, url: string }
```

## GET /api/rooms/[code]/images
해당 방에 업로드된 커스텀 이미지 목록.
```ts
{ images: Array<{ id: string, url: string }> }
```

## DELETE /api/rooms/[code]/images
방장이 대기실에서 업로드한 이미지 삭제. `{ id: string }`

---

## 어드민 (`x-admin-secret` 헤더 필수, `ADMIN_SECRET` 환경변수와 일치해야 함)

## GET /api/admin/images
공용 라이브러리 이미지 목록 (`room_id IS NULL`). 페이지네이션 `?page=`.
```ts
{ images: Array<{ id, url, source, license, source_url, category, active, exposures, vote_variance }>, total: number, page: number, limit: number }
```

## POST /api/admin/images
공용 라이브러리에 이미지 직접 업로드 (외부 API로 못 채우는 자체 AI 생성 이미지 등).
`multipart/form-data`: `file`(jpg/png/webp ≤8MB), `source`('AI'|'USER'), `license`('OWN'|'CC0'|'PD'|'KOGL-1'),
`source_url`(필수 — `docs/content.md` 출처표시 의무), `category`(선택), `era`(선택).
Supabase Storage `library-images` 버킷에 저장, `images.room_id = NULL`로 등록 (전체 방에서 공용 재사용).
```ts
// res 201
{ id: string, url: string }
```

## PATCH /api/admin/images
라이브러리 이미지 활성/비활성 토글. `{ id: string, active: boolean }`

---

## GET /api/cron/cleanup
Vercel Cron (`vercel.json`, 매일 03:00 KST). `Authorization: Bearer {CRON_SECRET}`.
`WAITING` 2시간 방치 / `GAME_OVER` 1시간 경과 방을 삭제. 삭제 전 `ROOM_CLOSED` broadcast.
방 삭제 시 해당 방의 `room-images` storage 파일도 함께 삭제한다 (커스텀 업로드는 경기 종료 후 남기지 않음).
