# 「그시절」 제목학원 — 요구사항명세서 v2.0
### Vercel 서버리스 · 무비용 배포 · 저작권 클린 · 끄투(KKuTu) 스타일 웹

> **v1 대비 변경점**
> - Spring Boot + WebSocket → **Next.js on Vercel + Supabase Realtime**
> - 모바일 퍼스트 → **끄투식 PC 3분할 (모바일은 탭 전환 대응)**
> - **채팅 추가** (끄투 재미의 절반은 채팅입니다)
> - 이미지 소싱 → **퍼블릭 도메인 미술관/기록보관소 API 중심**
> - 서버 권위 타이머 → **Deadline 기반 Lazy Transition** (항상 켜진 서버 없이 구현)

---

## 0. 가장 먼저 — Vercel의 벽 3개

이걸 모르고 시작하면 2주 날립니다.

| 벽 | 실체 | 해결 |
|---|---|---|
| ❌ **WebSocket 서버 불가** | Vercel 서버리스 함수는 요청-응답 후 죽습니다. Socket.io / STOMP 상주 불가 | **Supabase Realtime**을 메시지 버스로 사용 |
| ❌ **상주 타이머 불가** | `setTimeout`으로 45초 뒤 라운드 종료? 함수가 이미 죽어서 실행 안 됩니다 | **Deadline 기반 Lazy Transition** (§2.2) |
| ⚠️ **Hobby 플랜 = 비상업용** | Vercel 약관상 Hobby는 개인·비상업 전용. **광고 붙이는 순간 위반** | 검증까지는 Hobby, 수익화 시작 시 **Pro $20/mo** |

> **결론: "완전 무료"는 수익화 전까지만 가능합니다.** 그건 문제가 아닙니다 — 검증 단계엔 어차피 매출이 0이니까요.

---

## 1. 기술 스택 (무비용 구성)

| 레이어 | 선택 | 무료 한도 | 비고 |
|---|---|---|---|
| 프론트+API | **Next.js 15 (App Router) on Vercel** | Hobby 무료 | Route Handler = 게임 로직 권위 |
| 실시간 | **Supabase Realtime (Broadcast + Presence)** | **동시 200 연결**, 월 200만 메시지 | ★ 이게 진짜 병목 |
| DB | **Supabase Postgres** | 500MB | 게임 상태 + 결과 |
| 이미지 저장 | **Supabase Storage** | 1GB(무료 티어) | ★ [ADR 002](decisions/002-supabase-storage-not-r2.md) — R2 대신 채택. 별도 벤더/SDK 없이 기존 service_role 클라이언트 재사용 |
| 이미지 CDN | Supabase Storage Public Bucket | 무료 티어 포함 | `room-images`(경기 전용, 방 삭제 시 같이 삭제) / `library-images`(공용, 영구) 버킷 분리 |
| 정기 작업 | **Vercel Cron** (`/api/cron/cleanup`, 1일 1회) | Hobby 무료 | [ADR 001](decisions/001-serverless-lazy-transition.md)의 라운드 전이는 클라 트리거(tick) 유지. 유령 방 정리는 실제로 Vercel Cron으로 구현 |
| 결과 카드 | `@vercel/og` (Satori) | 무료 | 서버리스 PNG 생성 |
| 인증 | **없음** (익명 sessionId) | — | |

### 1.1 동시 200 연결 = 실질 상한

```
Realtime 연결 1개 = 유저 1명
200 연결 ÷ 평균 8명/방 ≈ 동시 25개 방
```

**이 숫자를 넘어가면 그건 좋은 문제입니다.** 그때 Supabase Pro($25) 또는 PartyKit/Cloudflare Durable Objects로 갈아타면 됩니다. 지금 걱정할 일이 아닙니다.

---

## 2. 아키텍처 — 서버 없이 서버 권위 만들기

### 2.1 원칙: 클라이언트는 DB를 직접 만지지 않는다

```
[Client] ──HTTP──► [Next.js Route Handler]  ← 게임 로직 권위 (service_role key)
   ▲                        │
   │                        ├─► Supabase Postgres  (상태 쓰기)
   │                        └─► Supabase Realtime Broadcast (이벤트 발행)
   │                                    │
   └────────────── 구독 ────────────────┘
```

- 클라이언트는 **Realtime Broadcast를 구독만** 합니다 (읽기 전용 소켓)
- 모든 쓰기(제출/투표/시작)는 **API Route를 경유**
- Supabase RLS로 곡예하지 말고 **테이블 직접 접근을 전부 차단**하는 게 안전하고 간단합니다

> **부가 효과**: 게임 로직이 API Route에 모여 있으면, 나중에 **Spring Boot로 이전할 때 그 레이어만 들어내면 됩니다.** (§11 참조)

### 2.2 Deadline 기반 Lazy Transition ★ 이 설계가 핵심입니다

상주 서버가 없으니 "45초 뒤에 서버가 라운드를 끝낸다"가 불가능합니다. 뒤집습니다.

```
1. 라운드 시작 시 DB에 저장:  phase = 'WRITING',  deadline = now() + 45s
2. 클라이언트는 deadline을 받아 로컬에서 카운트다운 렌더링 (단순 표시)
3. deadline 도달 → 각 클라이언트가 POST /api/rooms/{code}/tick
4. 서버는 조건부 UPDATE 로 전이:

   UPDATE rooms
      SET phase = 'VOTING', deadline = now() + 30s
    WHERE code = $1
      AND phase = 'WRITING'      -- ← 이미 넘어갔으면 0 rows
      AND round = $2
      AND deadline <= now()      -- ← 아직 안 됐으면 0 rows

5. 1 row 갱신된 요청만 승자 → Broadcast 발행
   나머지는 0 rows → 조용히 무시 (멱등)
```

**이 패턴의 장점**
- 상주 서버 불필요, 크론 불필요
- 클라이언트가 시계를 조작해도 **`deadline <= now()`를 서버가 검증**하므로 조기 전이 불가
- N명이 동시에 `tick`을 쏴도 **DB 원자성이 정확히 1명만 통과**시킴
- 전원이 브라우저를 닫으면 방이 멈춤 → **pg_cron이 유령 방 정리** (§2.3)

**조기 전이(전원 제출)**: `POST /submit` 핸들러가 `제출수 == 생존자수`를 확인하고 같은 조건부 UPDATE로 즉시 전이.

### 2.3 유령 방 정리 (Supabase pg_cron, 5분마다)

```sql
-- 30분 이상 갱신 없는 방 삭제
DELETE FROM rooms WHERE updated_at < now() - interval '30 minutes';
-- deadline 5분 이상 지났는데 아직 안 넘어간 방 = 전원 이탈 → 삭제
DELETE FROM rooms WHERE deadline < now() - interval '5 minutes';
```

### 2.4 접속 감지 = Supabase Presence

- 각 클라이언트가 채널 join 시 `{playerId, nickname}` presence track
- `leave` 이벤트 → 남아있는 클라이언트 중 **가장 오래된 1명**이 `POST /api/rooms/{code}/sync` 호출 → 서버가 이탈 확정 처리
- 새로고침 = presence leave → **30초 유예 후 확정** (그 안에 돌아오면 복귀)

---

## 3. 이미지 전략 — 저작권 100% 클린 ★ 그리고 이게 차별점입니다

### 3.1 소스 (전부 퍼블릭 도메인 / CC0)

| 소스 | 규모 | 라이선스 | 왜 좋은가 |
|---|---|---|---|
| **The Met Open Access API** | 49만+ | **CC0** | ★ **기괴한 옛날 초상화·정물화.** "중세 그림 짤"은 이미 검증된 밈 포맷 |
| **Smithsonian Open Access** | 450만+ | **CC0** | 표본·유물·옛 사진. 괴상한 게 무한히 나옴 |
| **Rijksmuseum API** | 70만+ | Public Domain | 네덜란드 회화. 표정이 웃김 |
| **Library of Congress** | 대량 | Public Domain | 20세기 초 미국 사진 |
| **NASA Image Library** | 대량 | Public Domain | 우주·실험 장면 |
| **공공누리 제1유형** (공유마당, e뮤지엄) | 대량 | 출처표시 후 자유 | ★ **한국 옛 사진.** "그시절" 브랜드 직결 |
| **AI 생성 (자체 제작)** | 무제한 | 자체 자산 | 부족한 카테고리 보충 |

### 3.2 이건 타협이 아니라 오히려 강점입니다

**"저작권 때문에 어쩔 수 없이 명화를 쓴다"가 아닙니다.**

- 방송 캡처 짤은 **이미 다 소진된 포맷**입니다. 사람들이 원본을 압니다 → 제목이 뻔해짐
- 3백 년 전 네덜란드 아저씨의 어이없는 표정은 **아무도 맥락을 모릅니다** → 순수 창작이 나옴
- 그리고 이건 **"그시절 = 시대·추억"** 브랜드와 정확히 맞물립니다
- **경쟁사가 못 따라옵니다** — 저작권 짤로 굴리는 서비스는 트래픽 나오는 순간 내용증명 받습니다

### 3.3 파이프라인

```
[수집 스크립트]  Met/Smithsonian/Rijks API → 필터 → 후보 300장
        ↓
[수동 큐레이션]  ★ 사람이 봐야 합니다. "웃긴가?" 는 자동화 불가
        ↓
[전처리]         1200px 리사이즈, WebP 변환, 워터마크 제거 없음(원본 PD)
        ↓
[Supabase Storage]  업로드 (`/admin` → POST /api/admin/images) + images 테이블에 메타 등록
                     (source, license, source_url ← 출처표시 의무 대비)
        ↓
[자동 품질 측정]  득표 분산도 낮은 사진 = 안 웃긴 사진 → 자동 비활성 (§6.5)
```

> **최소 150장 확보 전엔 오픈하지 마세요.** 8라운드 × 중복 없음 = 한 게임에 8장. 150장이면 20판은 안 겹칩니다.

---

## 4. 페이지 구성 — 끄투(KKuTu) 스타일

### 4.1 레이아웃 철학

끄투가 재밌는 건 **정보 밀도 + 채팅**입니다. 여백 많은 모던 UI로 만들면 그 맛이 안 납니다.
조밀한 3분할, 상시 채팅, 실시간으로 뭔가 계속 움직이는 화면.

### 4.2 로비 (`/`)

```
┌────────────────────────────────────────────────────────┐
│  그시절                        [닉네임: 안현준 ✎]  [방 만들기] │
├──────────────────────────────────────┬─────────────────┤
│  게임 선택 탭                          │  접속자 (37)     │
│  [제목학원] [시대퀴즈🔒] [그시절게임🔒]   │  ● 감자도리      │
├──────────────────────────────────────┤  ● 김철수        │
│  #  방제목            인원   상태       │  ● ...          │
│ ─────────────────────────────────────  │                 │
│  01 🔒 우리끼리       4/8   대기중  [입장]│                 │
│  02    아무나오세요   6/8   게임중  [관전]│                 │
│  03    ...                            │                 │
├──────────────────────────────────────┴─────────────────┤
│  로비 채팅                                              │
│  감자도리: 사람 좀 모아주세요                              │
│  > [                                        ] [전송]    │
└────────────────────────────────────────────────────────┘
```

### 4.3 방 — 대기실 (`/room/[code]`, phase=WAITING)

```
┌────────────────────────────────────────────────────────┐
│  방 #12  우리끼리 🔒          [초대링크 복사] [카톡 공유]   │
├──────────────┬───────────────────────────┬─────────────┤
│  참가자 (4/8) │  방 설정                   │  채팅        │
│              │  목숨    [3]               │             │
│ ┌──────────┐ │  작성시간 [45초]           │  철수: ㅋㅋㅋ │
│ │👑 안현준  │ │  이미지팩 [기본]           │  영희: 시작해│
│ │   감자도리│ │  방 타입  [🔒 잠금]        │             │
│ │   김철수  │ │                           │             │
│ │   (빈자리)│ │  ┌─────────────────────┐  │             │
│ └──────────┘ │  │    게 임  시 작       │  │  > [      ] │
│              │  └─────────────────────┘  │             │
└──────────────┴───────────────────────────┴─────────────┘
```

### 4.4 게임 진행 (phase=WRITING / VOTING / ROUND_RESULT)

```
┌────────────────────────────────────────────────────────┐
│  ROUND 3            ⏱ 00:23            제출 4/6         │
├──────────────┬───────────────────────────┬─────────────┤
│  참가자       │                           │  채팅        │
│  안현준 ♥♥♥  │      ┌───────────────┐    │             │
│  감자도리 ♥♥  │      │               │    │  철수: 뭐야  │
│  김철수 ♥     │      │    [ 이미지 ]  │    │  영희: ㅋㅋ  │
│  ─────────   │      │               │    │             │
│  💀 관전 (2)  │      └───────────────┘    │             │
│  영희(심사위원)│                           │             │
│              │  > [제목을 입력하세요   ] ✓│  > [      ] │
└──────────────┴───────────────────────────┴─────────────┘
```

**VOTING 단계**: 중앙 하단이 **익명 제목 리스트**로 교체, 클릭 = 투표
**ROUND_RESULT**: 득표순 + 작성자 공개, 최하위 하트 깨지는 연출

### 4.5 모바일 대응 (카톡 링크 유입 = 절반 이상)

PC 3분할을 **하단 탭 3개**로 접습니다.

```
[ 게임 ]  [ 채팅 🔴 ]  [ 참가자 ]
```
- 기본 = 게임 탭
- 채팅 새 메시지 → 뱃지
- 게임 탭에는 목숨/타이머/제출현황만 압축 노출

> **PC와 모바일 중 하나만 고르라면 PC입니다** (끄투 감성). 하지만 **초대 링크가 카톡으로 날아가는 이상 모바일을 버릴 수 없습니다.** 반응형이 아니라 **두 개의 레이아웃**을 만든다고 생각하세요.

### 4.6 채팅 — 넣되, 한 군데를 막아야 합니다

| Phase | 채팅 |
|---|---|
| WAITING | ✅ 자유 |
| **WRITING** | ⚠️ **허용하되, "제출 완료자 전용"** ← 미제출자는 못 씀 |
| VOTING | ⚠️ **차단** (담합/구걸 방지: "내꺼 3번이야") |
| ROUND_RESULT | ✅ 자유 ← **여기가 제일 재밌음. 야유·환호** |
| GAME_OVER | ✅ 자유 |

> VOTING 채팅을 열어두면 **게임이 즉시 망가집니다.** 자기 제목 번호를 흘리는 순간 투표가 인기투표가 됩니다. 반드시 막으세요.

---

## 5. 게임 상태 머신

```
WAITING ──(방장 시작, 3명↑)──► WRITING(45s) ──► VOTING(30s) ──► ROUND_RESULT(15s)
   ▲                                                                    │
   │                                              ┌─── 생존 2명↑ ────────┤
   │                                              │                     │
   │                                              ▼                생존 1명↓
   └──────────(한 판 더)────────── GAME_OVER ◄────────────────────────┘
```

모든 전이는 **§2.2 Deadline Lazy Transition** 또는 **전원 완료 조기 전이**로만 발생.

---

## 6. 기능 명세

> P0 = MVP 필수 / P1 = MVP 권장 / P2 = v1 이후

### 6.1 방

| ID | 기능 | 설명 | P |
|---|---|---|---|
| RM-01 | 방 생성 | 6자리 코드 (`0/O/1/I` 제외) | P0 |
| RM-02 | 로비 목록 | 공개방 + 🔒잠금방. 비밀방 제외. **Realtime 구독으로 실시간 갱신** | P0 |
| RM-03 | 🌐 공개방 | 로비 노출, 비번 없음 | P0 |
| RM-04 | 🔒 잠금방 | **로비 노출 + 자물쇠**, 클릭 시 4자리 비번 모달 | P0 |
| RM-05 | 🕶️ 비밀방 | 로비 미노출, 링크 전용 | P0 |
| RM-06 | 초대 링크 | `/join/{code}?t={token}` — **유효 토큰이면 비번 스킵** | P0 |
| RM-07 | 카카오 공유 | Kakao SDK, OG 이미지 포함 | P0 |
| RM-08 | 비번 브루트포스 방어 | 5회 실패 → 60초 쿨다운 (Supabase에 카운트) | P0 |
| RM-09 | 인원 제한 | 3~12 | P0 |
| RM-10 | 방장 승계 | 방장 이탈 시 최고참에게 자동 승계 | P0 |
| RM-11 | 강퇴 | 방장 권한 | P1 |
| RM-12 | 게임 중 입장 | **관전자로 입장** → 다음 게임부터 참여 | P1 |
| RM-13 | 유령 방 정리 | pg_cron 5분 주기 | P0 |

### 6.2 참가자

| ID | 기능 | 설명 | P |
|---|---|---|---|
| PL-01 | 닉네임 | 2~8자, 금칙어 필터, 방 내 중복 시 `(2)` | P0 |
| PL-02 | 익명 세션 | `localStorage`의 `sessionId` (UUID). **로그인 없음** | P0 |
| PL-03 | 재접속 복귀 | 새로고침 → `GET /api/rooms/{code}/state` 스냅샷으로 완전 복원 | P0 |
| PL-04 | Presence 이탈 감지 | 30초 유예 후 관전자 전환 | P0 |

### 6.3 게임 (제목학원)

| ID | 기능 | 설명 | P |
|---|---|---|---|
| GM-01 | 이미지 배정 | **한 게임 내 중복 없음** (`used_image_ids` 배열로 관리) | P0 |
| GM-02 | 제목 제출 | 40자, 마감 전 수정 가능 | P0 |
| GM-03 | 미제출 처리 | 투표 대상 제외 + **자동 최하위 확정** | P0 |
| GM-04 | 익명 공개 | 작성자 숨김, 순서 셔플 (서버가 셔플) | P0 |
| GM-05 | 투표 | 1인 1표, **자기 것 선택 불가** | P0 |
| GM-06 | 관전자 투표권 | 탈락자도 투표 가능 (심사위원단) | P0 |
| GM-07 | 최하위 목숨 -1 | | P0 |
| GM-08 | 동점 최하위 | **전원** -1 (재투표 없음) | P0 |
| GM-09 | 동시 탈락 | 마지막 2명 동시 소진 → **공동 우승** | P0 |
| GM-10 | 인원 부족 중단 | 생존 3명 미만 → 대기실 복귀 | P0 |
| GM-11 | Deadline 검증 | 서버가 `deadline <= now()` 로 조기/지연 제출 거부 | P0 |
| GM-12 | 조기 전이 | 전원 제출/투표 시 즉시 다음 단계 | P0 |
| GM-13 | 관전자 이모지 | 👏 😂 🤮 플로팅 | P2 |

### 6.4 채팅

| ID | 기능 | 설명 | P |
|---|---|---|---|
| CH-01 | 로비 채팅 | Realtime Broadcast, **DB 저장 안 함** (휘발) | P0 |
| CH-02 | 방 채팅 | 동일. 최근 50개만 클라이언트 메모리 | P0 |
| CH-03 | **VOTING 채팅 차단** | ★ 서버가 phase 검증 후 거부 | P0 |
| CH-04 | WRITING 제출자 전용 | 미제출자 발언 차단 | P1 |
| CH-05 | 금칙어 + Rate Limit | 초당 1회, 100자 | P0 |

### 6.5 콘텐츠 · 운영

| ID | 기능 | 설명 | P |
|---|---|---|---|
| CT-01 | 이미지 150장 | Met/Smithsonian/공유마당 + 수동 큐레이션 | P0 |
| CT-02 | 출처 표시 | `source_url` 저장, 하단 크레딧 페이지 (공공누리 의무) | P0 |
| CT-03 | 어드민 | 이미지 활성/비활성, 신고 처리 | P0 |
| CT-04 | **득표 분산 자동 측정** | 분산 낮은 이미지 = 안 웃김 → 노출 하향/비활성 | P1 |
| CT-05 | 신고 | 제목/닉네임 | P1 |

### 6.6 공유

| ID | 기능 | 설명 | P |
|---|---|---|---|
| SH-01 | 결과 카드 | `@vercel/og`로 PNG 생성 (사진 + 우승 제목 + 초대 링크) | P0 |
| SH-02 | 카톡/이미지 저장 | | P0 |
| SH-03 | **한 판 더** | 참가자 유지, 대기실 복귀 ★ 리텐션 핵심 | P0 |

### 6.7 계측

| ID | 지표 |
|---|---|
| AN-01 | **"한 판 더" 클릭률** ★ 유일한 정직한 재미 지표 |
| AN-02 | 방 생성 → 게임 시작 전환율 |
| AN-03 | 라운드별 이탈률 |
| AN-04 | 결과 카드 공유율 |
| AN-05 | 이미지별 득표 분산 |
| AN-06 | Realtime 동시 연결 수 (200 상한 감시) |

---

## 7. DB 스키마 (Supabase Postgres)

```sql
-- 방 (게임 상태 = 진실의 원천)
CREATE TABLE rooms (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          char(6) UNIQUE NOT NULL,
  name          text NOT NULL,
  room_type     text NOT NULL CHECK (room_type IN ('PUBLIC','LOCKED','SECRET')),
  password_hash text,
  invite_token  text NOT NULL,
  max_players   int  NOT NULL DEFAULT 8,
  lives         int  NOT NULL DEFAULT 3,
  write_sec     int  NOT NULL DEFAULT 45,
  host_id       uuid,
  phase         text NOT NULL DEFAULT 'WAITING',
  round         int  NOT NULL DEFAULT 0,
  deadline      timestamptz,          -- ★ Lazy Transition 의 핵심
  current_image uuid REFERENCES images(id),
  used_images   uuid[] NOT NULL DEFAULT '{}',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
CREATE INDEX ON rooms (room_type, updated_at);  -- 로비 목록
CREATE INDEX ON rooms (deadline);               -- pg_cron 정리

CREATE TABLE players (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    uuid REFERENCES rooms(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  nickname   text NOT NULL,
  lives      int  NOT NULL DEFAULT 3,
  alive      boolean NOT NULL DEFAULT true,
  connected  boolean NOT NULL DEFAULT true,
  joined_at  timestamptz DEFAULT now(),
  UNIQUE (room_id, session_id)
);

CREATE TABLE submissions (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id   uuid REFERENCES rooms(id) ON DELETE CASCADE,
  round     int NOT NULL,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  title     text NOT NULL,
  UNIQUE (room_id, round, player_id)   -- 1인 1제출
);

CREATE TABLE votes (
  room_id       uuid REFERENCES rooms(id) ON DELETE CASCADE,
  round         int NOT NULL,
  voter_id      uuid REFERENCES players(id) ON DELETE CASCADE,
  submission_id uuid REFERENCES submissions(id) ON DELETE CASCADE,
  PRIMARY KEY (room_id, round, voter_id)  -- 1인 1표
);

-- 이미지 (영구 자산)
CREATE TABLE images (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url         text NOT NULL,          -- Supabase Storage public URL (또는 외부 CDN 원본 URL)
  source      text NOT NULL,          -- 'MET' | 'SMITHSONIAN' | 'KOGL' | 'AI'
  license     text NOT NULL,          -- 'CC0' | 'PD' | 'KOGL-1' | 'OWN'
  source_url  text,                   -- 출처표시 의무 대비
  era         text,                   -- v2 시대퀴즈 연동
  tags        text[],
  active      boolean DEFAULT true,
  exposures   int DEFAULT 0,
  vote_variance real                  -- ★ 낮으면 안 웃긴 사진
);

CREATE TABLE game_results (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code    char(6),
  player_count int,
  round_count  int,
  winners      text[],
  duration_sec int,
  played_at    timestamptz DEFAULT now()
);

CREATE TABLE highlights (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id uuid REFERENCES game_results(id) ON DELETE CASCADE,
  round     int,
  image_id  uuid REFERENCES images(id),
  title     text,
  author    text,
  votes     int
);
```

**RLS**: 모든 테이블 `ENABLE ROW LEVEL SECURITY` + **정책 없음** (= anon key로 아무것도 못 읽음).
접근은 **service_role key를 쓰는 Next.js Route Handler 경유만**.
→ 클라이언트가 `submissions`를 훔쳐보는 치팅이 원천 차단됩니다.

---

## 8. API 명세 (Next.js Route Handlers)

| Method | Path | 설명 |
|---|---|---|
| `POST` | `/api/rooms` | 방 생성 → `{ code, inviteToken }` |
| `GET` | `/api/rooms` | 로비 목록 (PUBLIC + LOCKED) |
| `POST` | `/api/rooms/[code]/join` | 입장 (비번 or 토큰 검증) → `{ playerId }` |
| `GET` | `/api/rooms/[code]/state` | **전체 스냅샷** ★ 재접속 복원의 전부 |
| `POST` | `/api/rooms/[code]/start` | 게임 시작 (방장) |
| `POST` | `/api/rooms/[code]/submit` | 제목 제출 (deadline 검증) |
| `POST` | `/api/rooms/[code]/vote` | 투표 (자기 것 거부, deadline 검증) |
| `POST` | `/api/rooms/[code]/tick` | ★ **Lazy Transition 트리거** (멱등) |
| `POST` | `/api/rooms/[code]/chat` | 채팅 (**phase 검증** → VOTING 차단) |
| `POST` | `/api/rooms/[code]/sync` | Presence 이탈 반영 |
| `POST` | `/api/rooms/[code]/rematch` | 한 판 더 |
| `GET` | `/api/og/result/[resultId]` | 결과 카드 PNG (`@vercel/og`) |

### 8.1 Realtime Broadcast 이벤트 (`room:{code}` 채널)

| Event | Payload |
|---|---|
| `PHASE_CHANGED` | `{ phase, round, deadline }` |
| `IMAGE_REVEALED` | `{ imageUrl }` |
| `PLAYER_UPDATE` | `{ players: [...] }` |
| `HOST_CHANGED` | `{ newHostId }` |
| `SUBMIT_PROGRESS` | `{ submitted, total }` |
| `SUBMISSIONS_REVEALED` | `{ submissions: [{id, title}] }` — **작성자 미포함** |
| `VOTE_PROGRESS` | `{ voted, total }` |
| `ROUND_RESULT` | `{ ranking, eliminated, lives }` |
| `GAME_OVER` | `{ winners, highlights, resultId }` |
| `CHAT` | `{ nickname, message }` |

> Broadcast는 **Route Handler가 HTTP로 발행**합니다 (Supabase Realtime REST broadcast endpoint).
> 클라이언트는 구독만 하고, 발행 권한이 없습니다.

---

## 9. 치팅 방지 (서버리스라서 더 중요합니다)

| 공격 | 방어 |
|---|---|
| DevTools로 남의 제목 훔쳐보기 | **RLS 전면 차단.** 제목은 VOTING 시점에 서버가 Broadcast로만 공개 |
| 자기 제목에 투표 | 서버가 `submission.player_id != voter_id` 검증 |
| 시계 조작으로 시간 연장 | 서버가 `deadline`을 DB 시각 기준 검증 |
| `tick` 스팸 | 조건부 UPDATE라 멱등. 0 rows면 no-op |
| 다중 탭으로 2표 | `votes` PK가 `(room_id, round, voter_id)` |
| 봇 방 생성 스팸 | IP당 분당 5회 Rate Limit (Vercel Edge Middleware) |
| VOTING 중 담합 | **채팅 차단** (CH-03) |

---

## 10. 반드시 처리할 예외

- [ ] 방장이 게임 중 이탈 → 승계, 게임 계속
- [ ] 전원 미제출 → 라운드 무효, 목숨 차감 없이 다음 라운드
- [ ] 아무도 투표 안 함 → 라운드 무효
- [ ] 동점 최하위 3명 → 3명 전부 -1
- [ ] 마지막 2명 동시 탈락 → 공동 우승
- [ ] 새로고침 → `GET /state` 스냅샷 복원
- [ ] **전원 브라우저 닫음** → 방이 `deadline`에 멈춤 → pg_cron이 정리
- [ ] 생존자 3명 미만 → 게임 중단
- [ ] 두 탭 동시 입장 → 같은 `sessionId` → 같은 플레이어로 병합
- [ ] 이미지 로딩 실패 → 대체 이미지 + 해당 라운드 시간 연장
- [ ] Realtime 연결 끊김 → 자동 재구독 + `/state` 재동기화
- [ ] **Realtime 200 연결 초과** → 신규 방 생성 차단 + "잠시 후 시도" 안내

---

## 11. 포트폴리오 관점 — 솔직하게 짚어야 할 것

**Next.js + Supabase는 백엔드 실력을 보여주기에 약합니다.** 냉정하게, 채용담당자 눈엔 "BaaS 갖다 쓴 프론트 프로젝트"로 보일 수 있습니다. Spring Boot 백엔드로 취업하려는 상황에서 이건 그냥 넘어갈 문제가 아닙니다.

**그런데 이 프로젝트의 목적은 코드가 아닙니다.**
지금 포트폴리오의 유일한 구멍은 **"모든 부하 지표가 Testcontainers/k6 시뮬레이션"** 이라는 점입니다. 필요한 건 **실제 사람이 쓰는 트래픽**입니다. 그건 Spring Boot로 만들든 Next.js로 만들든 똑같이 얻습니다. 그리고 무료로 빨리 만들수록 빨리 얻습니다.

**그래서 2단계로 갑니다.**

| 단계 | 스택 | 목적 |
|---|---|---|
| **Phase 1 (지금)** | Vercel + Supabase | **0원으로 빠르게 출시 → 실 유저 확보 → 지표 수집** |
| **Phase 2 (유저가 붙으면)** | **Spring Boot + WebSocket + Redis**로 게임 서버 이관 | ★ 여기가 진짜 이야깃거리 |

Phase 2가 면접에서 강력한 이유:
> "서버리스로 검증했더니 Supabase Realtime 200 연결 상한에 걸렸습니다. 동시 접속 N명을 처리하기 위해 Spring Boot + WebSocket + Redis Pub/Sub으로 게임 서버를 이관했고, Deadline 기반 lazy transition을 서버 권위 스케줄러로 대체했습니다."

**이건 "만들어봤습니다"가 아니라 "한계를 만나서 해결했습니다"입니다.** 완전히 다른 레벨의 서사입니다.
그래서 §2.1에서 **게임 로직을 Route Handler 한 레이어에 몰아넣으라**고 한 겁니다. 그 레이어만 들어내면 이전이 끝나게.

---

## 12. 개발 순서 (4~5주)

| 주차 | 작업 |
|---|---|
| **0주** ★ | **Met/Smithsonian API로 이미지 300장 수집 → 150장 큐레이션 → 카톡방에서 수동 플레이 테스트.** 안 웃기면 여기서 접습니다 |
| 1주 | Next.js 셋업, Supabase 스키마, 방 CRUD, 로비, Realtime 구독/Presence |
| 2주 | 대기실, 게임 상태 머신, **Deadline Lazy Transition**, 제출/투표/채점 |
| 3주 | 재접속 복원(`/state`), 예외 처리 전부, 관전자, 채팅(+VOTING 차단) |
| 4주 | 끄투 스타일 UI 마감, 모바일 탭 레이아웃, 결과 카드(@vercel/og), 카톡 공유 |
| 5주 | 어드민, 금칙어/Rate Limit, 계측, 지인 30명 테스트 |

---

## 13. 성공 기준

| 지표 | 목표 | 못 넘으면 |
|---|---|---|
| **"한 판 더" 클릭률** | **≥ 50%** | 게임이 안 재밌음. 룰 또는 **사진**을 고쳐야 함 |
| 평균 게임 시간 | 8~10분 | 넘으면 라운드 시간 단축 |
| 게임 중 이탈률 | ≤ 15% | 관전자 경험 문제 |
| 결과 카드 공유율 | ≥ 20% | 바이럴 불가 → 카드 재설계 |

> **`한 판 더` 50%만 보면 됩니다.** 이걸 못 넘으면 나머지는 전부 의미 없습니다.

---

## 14. 마지막 경고

1. **Vercel Hobby로 광고 붙이면 약관 위반입니다.** 수익화 시작 = Pro $20/mo. 그때는 매출이 있으니 문제없습니다.
2. **Realtime 200 연결이 유일한 하드 리밋입니다.** 여기 부딪히는 날이 Phase 2 시작일입니다.
3. **이 서비스의 성패는 90%가 사진 큐레이션입니다.** 아키텍처가 아니라. 300장 모아서 웃긴 150장 고르는 그 작업이 진짜 개발입니다. 코드 한 줄 짜기 전에 하세요.
