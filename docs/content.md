# 콘텐츠 — 이미지 소싱

## 허용 소스

| 소스 | 규모 | 라이선스 |
|---|---|---|
| The Met Open Access | 49만+ | CC0 |
| Smithsonian Open Access | 450만+ | CC0 |
| Rijksmuseum | 70만+ | Public Domain |
| Library of Congress | 대량 | Public Domain |
| NASA Image Library | 대량 | Public Domain |
| 공유마당 / e뮤지엄 | 대량 | 공공누리 1유형 (출처표시) |
| 자체 AI 생성 | ∞ | 자체 자산 |

## 금지
구글 이미지 / 방송·영화 캡처 / 뉴스 사진 / 라이선스 미확인 전부.
**"아마 괜찮겠지"는 금지어다.**

## 필수 메타
`source`, `license`, `source_url` — 셋 다 NOT NULL.
`source_url` 없으면 등록하지 마라 (공공누리 출처표시 의무 + `/credits` 페이지).

## 큐레이션 기준
> "이 사진을 보고 웃긴 제목이 떠오르는가?"

- 표정 이상한 초상화 ✅
- 맥락 없는 기묘한 장면 ✅
- 예쁜 풍경 ❌ (아무 말도 안 떠오름)

## 자동 품질 측정 ★
```
득표 분산 높음 = 표가 한둘에 몰림 = 확실히 웃긴 답이 나옴 = 좋은 사진
득표 분산 낮음 = 표가 흩어짐       = 아무도 안 웃김      = 나쁜 사진
```
`images.vote_variance` 하위 20장 → 자동 비활성.
사람이 300장을 계속 손으로 고를 수는 없다.

## 오픈 전제 조건
**최소 150장.** 그 전엔 오픈하지 마라. (한 게임 8장 × 중복 없음)
