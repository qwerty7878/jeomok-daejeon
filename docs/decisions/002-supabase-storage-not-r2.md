# ADR 002 — 이미지 저장을 R2가 아닌 Supabase Storage로

## 상태
채택

## 맥락
`docs/spec.md`는 원래 이미지 저장소로 Cloudflare R2(egress 무료)를 지정했다.
그런데 실제로는 두 가지 업로드 경로가 이미 Supabase Storage로 구현되어 있었다:

- `POST /api/rooms/[code]/images` — 방장이 대기실에서 올리는 **경기 전용 커스텀 이미지** (`room-images` 버킷)
- `POST /api/admin/images` (신규) — 관리자가 올리는 **공용 라이브러리 이미지** (`library-images` 버킷)

두 경로 모두 R2 대신 Supabase Storage를 썼고, 문서와 코드가 어긋난 상태였다.

## 대안
1. 기존 코드를 R2로 마이그레이션 → Cloudflare 계정/버킷/API 토큰 발급, `@aws-sdk/client-s3`(R2는 S3 호환) 신규 의존성 필요. **기각**: 이미 동작하는 기능을 새 벤더로 옮길 이유가 약하고, 별도 자격증명 관리 부담만 늘어남.
2. Supabase Storage로 통일, 버킷/경로만 분리 → **채택**

## 결정
스토리지 벤더를 **Supabase Storage 하나로 통일**한다. `service_role` 클라이언트를 그대로 재사용하므로 신규 SDK·환경변수가 필요 없다.
버킷은 용도별로 분리해 수명 주기를 다르게 관리한다:

- `room-images/{roomCode}/{ts}.{ext}` — **경기 전용.** 방이 cleanup cron(`GET /api/cron/cleanup`)에서 삭제될 때 storage 파일도 함께 삭제한다. `images` row는 `room_id` FK CASCADE로 이미 같이 지워지고 있었지만, storage 객체는 지워지지 않아 고아 파일이 쌓이는 버그가 있었다 — 이번에 같이 고쳤다.
- `library-images/{ts}-{rand}.{ext}` — **영구 자산** (`room_id = NULL`). 모든 방에서 공용으로 재사용. `docs/content.md`의 출처표시 의무(`source`, `license`, `source_url` NOT NULL)를 업로드 API 레벨에서 검증한다.

## 결과
- ✅ 신규 벤더/자격증명 없이 기존 인프라로 두 업로드 경로 모두 완결
- ✅ "경기 전용 이미지는 서버에 영구히 남기지 않는다"는 요구사항을 cleanup cron이 실제로 보장 (이전엔 DB row만 지워지고 파일은 안 지워졌음)
- ⚠️ Supabase Storage 무료 티어는 1GB — R2(10GB)보다 작음. 라이브러리 이미지가 많아지면(리사이즈/WebP 전처리 미구현 상태라 원본 그대로 저장 중) 유료 티어 전환을 검토해야 한다.
- ⚠️ `docs/spec.md` §2.1 기술 스택 표, §3.3 파이프라인 다이어그램, `docs/pages.md` AD-04를 이 결정에 맞춰 갱신함.
