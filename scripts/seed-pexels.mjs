/**
 * Pexels API → images 테이블 시드 (실제 고화질 사진, 카테고리별)
 * Pexels License: 상업적 이용 가능, 귀속 불필요
 * 실행: node scripts/seed-pexels.mjs
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(join(__dir, "..", ".env.local"), "utf-8");
const env = Object.fromEntries(
  envText.split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const PEXELS_KEY = env.PEXELS_API_KEY;

if (!SUPABASE_URL || !SERVICE_KEY || !PEXELS_KEY) {
  console.error("❌ .env.local에 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / PEXELS_API_KEY 필요");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 카테고리별 검색어 — 게임 목적: 웃기거나 기묘하거나 표정이 풍부한 사진
const CATEGORY_QUERIES = {
  animals: [
    { q: "funny cat expression",      pages: 2 },
    { q: "dog surprised expression",  pages: 2 },
    { q: "penguin waddling",          pages: 1 },
    { q: "fox portrait wildlife",     pages: 1 },
    { q: "owl portrait close up",     pages: 1 },
    { q: "rabbit funny",              pages: 1 },
    { q: "capybara",                  pages: 1 },
    { q: "bear wildlife",             pages: 1 },
    { q: "parrot colorful",           pages: 1 },
    { q: "goat funny expression",     pages: 1 },
    { q: "duck portrait",             pages: 1 },
    { q: "frog macro close",          pages: 1 },
  ],
  nature: [
    { q: "lightning storm dramatic",  pages: 2 },
    { q: "waterfall dramatic",        pages: 2 },
    { q: "volcano eruption",          pages: 1 },
    { q: "aurora borealis",           pages: 1 },
    { q: "desert storm sand",         pages: 1 },
    { q: "iceberg ocean",             pages: 1 },
    { q: "tornado storm",             pages: 1 },
    { q: "huge wave ocean",           pages: 1 },
    { q: "mushroom forest",           pages: 1 },
    { q: "cave underground",          pages: 1 },
  ],
  people: [
    { q: "vintage portrait old photo",  pages: 2 },
    { q: "funny expression person",     pages: 2 },
    { q: "surprised face expression",   pages: 2 },
    { q: "confused person expression",  pages: 1 },
    { q: "elderly portrait expressive", pages: 1 },
    { q: "historical costume portrait", pages: 1 },
  ],
  other: [
    { q: "vintage retro advertisement",  pages: 2 },
    { q: "antique old object weird",     pages: 1 },
    { q: "bizarre unusual scene",        pages: 2 },
    { q: "abandoned place dramatic",     pages: 1 },
    { q: "vintage toy old",              pages: 1 },
    { q: "colorful market crowd",        pages: 1 },
    { q: "surreal scene unusual",        pages: 1 },
    { q: "old machine steampunk",        pages: 1 },
  ],
};

const PER_PAGE = 30; // Pexels 최대 80, 30이 품질↑

async function searchPexels(query, page = 1) {
  const params = new URLSearchParams({
    query,
    per_page: String(PER_PAGE),
    page: String(page),
    orientation: "landscape",  // 가로형 사진이 게임 화면에 잘 맞음
  });
  const r = await fetch(`https://api.pexels.com/v1/search?${params}`, {
    headers: { Authorization: PEXELS_KEY },
  });
  if (!r.ok) {
    console.error(`  Pexels API 오류: ${r.status}`);
    return [];
  }
  const d = await r.json();
  return d.photos ?? [];
}

async function getExistingUrls() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/images?select=source_url&limit=2000`,
    { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } }
  );
  return new Set((await res.json() || []).map((r) => r.source_url));
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
  console.log("📸 Pexels 고화질 이미지 시드 시작\n");

  const existingUrls = await getExistingUrls();
  console.log(`기존 이미지: ${existingUrls.size}장\n`);

  const TARGET_PER_CATEGORY = 50;
  const totals = {};

  for (const [category, queryList] of Object.entries(CATEGORY_QUERIES)) {
    console.log(`\n📂 카테고리: ${category}`);
    let catCount = 0;

    for (const { q, pages } of queryList) {
      if (catCount >= TARGET_PER_CATEGORY) break;

      for (let page = 1; page <= pages; page++) {
        if (catCount >= TARGET_PER_CATEGORY) break;

        await sleep(200); // Pexels rate limit 배려
        const photos = await searchPexels(q, page);

        for (const photo of photos) {
          if (catCount >= TARGET_PER_CATEGORY) break;

          // Pexels 페이지 URL을 source_url로 사용 (중복 방지 + 귀속 링크)
          const sourceUrl = photo.url;
          if (existingUrls.has(sourceUrl)) continue;

          // large2x(1920px) 우선, 없으면 large(940px)
          const imgUrl = photo.src.large2x || photo.src.large;

          const ok = await insertImage({
            url: imgUrl,
            source: "PEXELS",
            license: "PEXELS",
            source_url: sourceUrl,
            category,
            active: true,
          });

          if (ok) {
            existingUrls.add(sourceUrl);
            catCount++;
            process.stdout.write(
              `\r  "${q}" p${page}: ${catCount}/${TARGET_PER_CATEGORY}장  (${photo.photographer})`
            );
          }
        }
      }
    }

    totals[category] = catCount;
    console.log(`\n  → ${category}: 총 ${catCount}장 삽입`);
  }

  console.log("\n\n✅ 완료:");
  let grand = 0;
  for (const [cat, cnt] of Object.entries(totals)) {
    console.log(`  ${cat}: ${cnt}장`);
    grand += cnt;
  }
  console.log(`  합계: ${grand}장 추가`);
}

main().catch(console.error);
