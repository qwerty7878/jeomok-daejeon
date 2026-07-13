-- 그시절 제목학원 — DB 스키마 (SSOT)
-- 이 파일이 진실이다. 마이그레이션이 다르면 마이그레이션이 틀린 것이다.

CREATE TABLE images (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url           text NOT NULL,
  source        text NOT NULL,   -- 'MET'|'SMITHSONIAN'|'RIJKS'|'LOC'|'NASA'|'KOGL'|'AI'|'USER'
  license       text NOT NULL,   -- 'CC0'|'PD'|'KOGL-1'|'OWN'
  source_url    text NOT NULL,   -- ★ 출처표시 의무. NULL 금지
  era           text,
  tags          text[],
  category      text NOT NULL DEFAULT 'art',  -- 'art'|'nature'|'people'|'animals'|'other'
  room_id       text REFERENCES rooms(code) ON DELETE CASCADE,  -- NULL=공용 라이브러리, NOT NULL=방 전용
  active        boolean NOT NULL DEFAULT true,
  exposures     int NOT NULL DEFAULT 0,
  vote_variance real             -- 낮으면 안 웃긴 사진
);

CREATE TABLE rooms (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code           char(6) UNIQUE NOT NULL,        -- 0 O 1 I 제외
  name           text NOT NULL,
  room_type      text NOT NULL CHECK (room_type IN ('PUBLIC','LOCKED','SECRET')),
  password_hash  text,                            -- bcrypt. 평문 금지
  invite_token   text NOT NULL,
  max_players    int  NOT NULL DEFAULT 8  CHECK (max_players BETWEEN 3 AND 12),
  lives          int  NOT NULL DEFAULT 3  CHECK (lives BETWEEN 2 AND 5),
  write_sec      int  NOT NULL DEFAULT 45 CHECK (write_sec IN (30,45,60)),
  host_id        uuid,
  phase          text NOT NULL DEFAULT 'WAITING'
                 CHECK (phase IN ('WAITING','WRITING','VOTING','ROUND_RESULT','GAME_OVER')),
  round          int  NOT NULL DEFAULT 0,
  deadline       timestamptz,                     -- ★ Lazy Transition 의 심장
  current_image  uuid REFERENCES images(id),
  used_images    uuid[] NOT NULL DEFAULT '{}',    -- 한 게임 내 중복 방지
  image_source   text NOT NULL DEFAULT 'LIBRARY' CHECK (image_source IN ('LIBRARY','CUSTOM')),
  image_category text NOT NULL DEFAULT 'random',  -- 'random'|'art'|'nature'|'people'|'animals'|'other'
  game_mode      text NOT NULL DEFAULT 'SOLO' CHECK (game_mode IN ('SOLO','TEAM')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rooms_lobby_idx ON rooms (room_type, updated_at);
CREATE INDEX rooms_deadline_idx ON rooms (deadline);

CREATE TABLE players (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  nickname   text NOT NULL,
  lives      int  NOT NULL DEFAULT 3,
  alive      boolean NOT NULL DEFAULT true,
  connected  boolean NOT NULL DEFAULT true,
  team       text CHECK (team IN ('A','B')),      -- 팀전 모드에서만 사용. NULL = 개인전
  joined_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, session_id)                   -- 두 탭 = 같은 플레이어
);

CREATE TABLE submissions (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id   uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  round     int  NOT NULL,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  title     text NOT NULL CHECK (char_length(title) <= 40),
  UNIQUE (room_id, round, player_id)             -- 1인 1제출 (재제출 = 덮어쓰기)
);

CREATE TABLE votes (
  room_id       uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  round         int  NOT NULL,
  voter_id      uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  submission_id uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  PRIMARY KEY (room_id, round, voter_id)         -- ★ 1인 1표. 두 탭 2표 물리 차단
);

CREATE TABLE game_results (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code    char(6),
  player_count int,
  round_count  int,
  winners      text[],                            -- 공동 우승 가능
  duration_sec int,
  rematched    boolean NOT NULL DEFAULT false,    -- ★ "한 판 더" 계측
  played_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE highlights (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id uuid NOT NULL REFERENCES game_results(id) ON DELETE CASCADE,
  round     int,
  image_id  uuid REFERENCES images(id),
  title     text,
  author    text,
  votes     int
);

CREATE TABLE reports (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code        char(6),
  reporter_session text NOT NULL,
  target_type      text NOT NULL CHECK (target_type IN ('chat','title')),
  target_content   text NOT NULL,
  context          text,                         -- 채팅은 닉네임, 제목은 작성자
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','dismissed')),
  created_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE TABLE password_attempts (
  room_code  char(6) NOT NULL,
  session_id text NOT NULL,
  fails      int NOT NULL DEFAULT 0,
  locked_until timestamptz,
  PRIMARY KEY (room_code, session_id)
);

-- ★ RLS 전면 차단: 정책을 만들지 않는다 = anon 키로 아무것도 못 읽는다.
--   모든 접근은 service_role 키를 쓰는 Route Handler 경유.
ALTER TABLE rooms       ENABLE ROW LEVEL SECURITY;
ALTER TABLE players     ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE images      ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE highlights  ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_attempts ENABLE ROW LEVEL SECURITY;

-- 유령 방 정리 (pg_cron, 5분 주기)
-- SELECT cron.schedule('cleanup', '*/5 * * * *', $$
--   DELETE FROM rooms WHERE updated_at < now() - interval '30 minutes'
--      OR deadline < now() - interval '5 minutes';
-- $$);
