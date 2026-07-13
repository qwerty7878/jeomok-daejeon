/**
 * Met Museum Open Access API → images 테이블 시드
 * CC0 / Public Domain 전용. API 키 불필요.
 * 실행: node scripts/seed-images.mjs
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));

// .env.local 수동 로드
const envText = readFileSync(join(__dir, "..", ".env.local"), "utf-8");
const env = Object.fromEntries(
  envText.split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ .env.local에 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요");
  process.exit(1);
}

const MET = "https://collectionapi.metmuseum.org/public/collection/v1";

// 게임에 적합한 검색어: 이상한 표정, 기묘한 장면, 역사적 유머
const QUERIES = [
  "portrait painting",       // 이상한 표정의 초상화
  "caricature",              // 캐리커처 (의도적으로 웃긴)
  "genre scene",             // 일상의 기묘한 장면
  "satire",                  // 풍자화
  "allegory",                // 상징적 장면
  "peasant",                 // 농민 생활
  "feast banquet",           // 잔치 장면
  "hunting",                 // 사냥 장면
  "mythology",               // 신화 장면
  "battle",                  // 전투 장면
];

const TARGET = 150;           // 최소 목표 (오픈 조건)
const PER_QUERY = 40;         // 쿼리당 최대 시도 수
const SLEEP_MS = 200;         // Met API rate limit 배려

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function searchMet(q) {
  const url = `${MET}/search?hasImages=true&isPublicDomain=true&q=${encodeURIComponent(q)}`;
  const r = await fetch(url);
  try {
    const d = await r.json();
    return d.objectIDs || [];
  } catch {
    return [];
  }
}

async function fetchObject(id) {
  const r = await fetch(`${MET}/objects/${id}`);
  return r.json();
}

async function insertImage(img) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/images`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(img),
  });
  return r.ok;
}

async function main() {
  console.log("🎨 Met Museum 이미지 시드 시작\n");

  // 이미 있는 source_url 목록 가져오기 (중복 방지)
  const existingRes = await fetch(
    `${SUPABASE_URL}/rest/v1/images?select=source_url&limit=1000`,
    { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } }
  );
  const existingData = await existingRes.json();
  const existingUrls = new Set((existingData || []).map((r) => r.source_url));
  console.log(`기존 이미지: ${existingUrls.size}장\n`);

  let total = 0;

  for (const q of QUERIES) {
    if (total >= TARGET) break;

    const ids = await searchMet(q);
    // 랜덤 섞어서 샘플링 (다양성 확보)
    const shuffled = ids.sort(() => Math.random() - 0.5).slice(0, PER_QUERY);

    let qCount = 0;
    for (const id of shuffled) {
      if (total >= TARGET) break;
      await sleep(SLEEP_MS);

      try {
        const obj = await fetchObject(id);

        // 필수 필드 검증
        if (
          !obj.isPublicDomain ||
          !obj.primaryImageSmall ||
          !obj.objectURL ||
          existingUrls.has(obj.objectURL)
        ) continue;

        const ok = await insertImage({
          url: obj.primaryImageSmall,
          source: "MET",
          license: "CC0",
          source_url: obj.objectURL,
          era: (obj.period || obj.dynasty || obj.objectDate || null)?.slice(0, 100),
          tags: [obj.department, obj.classification].filter(Boolean),
          active: true,
          exposures: 0,
        });

        if (ok) {
          existingUrls.add(obj.objectURL);
          total++;
          qCount++;
          process.stdout.write(`\r  "${q}": +${qCount}장  (누계 ${total}/${TARGET})`);
        }
      } catch {
        // 네트워크 오류 skip
      }
    }
    console.log();
    await sleep(300);
  }

  console.log(`\n✅ 완료: 총 ${total}장 삽입`);
  if (total < TARGET) {
    console.log(`⚠️  목표 ${TARGET}장 미달. 추가 실행 또는 다른 검색어 추가 필요.`);
  }
}

main().catch(console.error);
