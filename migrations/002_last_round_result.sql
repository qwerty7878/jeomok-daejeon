-- Migration 002: rooms.last_round_result
-- Supabase SQL Editor에서 실행
--
-- 배경: GET /state가 ROUND_RESULT 단계일 때 랭킹을 자체적으로 재계산하고 있었는데,
-- 이게 실시간 브로드캐스트(computeAndBroadcastResult)와 다른 로직이라
-- (1) ranking.id에 제출물 ID를 넣는 버그가 있었고 (원래는 플레이어 ID여야 함)
-- (2) AI 스코어링 없이 득표수만으로 순위를 다시 매겨서 이미 목숨이 깎인 실제 결과와
--     불일치할 수 있었음. 브로드캐스트 시점의 결과를 그대로 저장해뒀다가 재접속 시
--     그대로 돌려주는 방식으로 수정.

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS last_round_result jsonb;
