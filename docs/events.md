# Realtime 이벤트 계약 (SSOT)

채널: `room:{code}` / `lobby`
방식: **Supabase Realtime Broadcast**

## 규칙

1. **발행은 서버만 한다.** Route Handler가 HTTP broadcast로 발행.
2. **클라이언트는 구독만 한다.** 발행 권한 없음.
3. **`postgres_changes`를 쓰지 마라.** 테이블이 그대로 노출된다. Broadcast만.
4. 이벤트는 **알림**이지 진실이 아니다. 의심스러우면 `GET /state`로 재동기화.

---

## `room:{code}`

| Event | Payload | 발행 시점 |
|---|---|---|
| `PHASE_CHANGED` | `{ phase, round, deadline }` | 모든 전이 |
| `IMAGE_REVEALED` | `{ imageUrl }` | WRITING 시작 |
| `PLAYER_UPDATE` | `{ players: Player[] }` | 입퇴장, 목숨 변화 |
| `HOST_CHANGED` | `{ newHostId }` | 방장 승계 |
| `SUBMIT_PROGRESS` | `{ submitted, total, playerIds }` | 제출마다. **제목 내용 없음**. playerIds = 제출 완료한 player_id[] |
| `SUBMISSIONS_REVEALED` | `{ submissions: [{id,title}] }` | VOTING 진입. **author 없음, 서버가 셔플** |
| `VOTE_PROGRESS` | `{ voted, total, voterIds }` | 투표마다. voterIds = 투표 완료한 player_id[] |
| `SKIP_READY` | `{ playerId }` | 결과 페이지에서 플레이어가 스킵 동의 |
| `ROUND_RESULT` | `{ ranking: [{id,title,author,votes,aiScore}], eliminated, losers, lives }` | 라운드 종료. `rooms.last_round_result`에 `{ranking,eliminated}` 그대로 저장됨 (재접속 시 `GET /state`가 재계산 없이 반환) |
| `GAME_OVER` | `{ winners, highlights, resultId }` | 게임 종료 |
| `REACTION` | `{ nickname, emoji }` | 리액션 이모지 (관전자 포함) |
| `CHAT` | `{ nickname, message, at, alive: boolean }` | 채팅 (VOTING 중엔 발행 안 됨). `alive=false`면 관전자 발화 |
| `ROOM_CLOSED` | `{ reason }` | 방 삭제 |

## 🚨 절대 금지 (어기면 DevTools로 게임이 뚫린다)

- `SUBMIT_PROGRESS`에 **제목 내용**을 담지 마라
- `SUBMISSIONS_REVEALED`에 **author**를 담지 마라 (ROUND_RESULT에서만 공개)
- `VOTE_PROGRESS`에 **투표 내역**을 담지 마라

## `lobby`

| Event | Payload |
|---|---|
| `ROOM_ADDED` / `ROOM_UPDATED` / `ROOM_REMOVED` | 로비 목록 갱신 (**SECRET 제외**) |
| `LOBBY_CHAT` | `{ nickname, message }` |

## Presence

- `room:{code}` 채널에 `{ playerId, nickname }` track
- `leave` 감지 → 남은 클라 중 **최고참 1명**이 `POST /sync` 호출
- 새로고침 = leave → **30초 유예** 후 이탈 확정
