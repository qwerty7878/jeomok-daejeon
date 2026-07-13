/**
 * Wikimedia Commons → images 테이블 시드 (동물/자연/사람/기타 다양한 카테고리)
 * CC0 / Public Domain / CC-BY 전용. API 키 불필요.
 * 실행: node scripts/seed-diverse.mjs
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

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ .env.local에 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요");
  process.exit(1);
}

const WIKI_API = "https://commons.wikimedia.org/w/api.php";

// 허용 라이선스 (출처 표시 가능 범위)
const OK_LICENSES = ["cc0", "cc-zero", "public domain", "pd", "cc-by", "cc by"];
const isOkLicense = (l = "") => OK_LICENSES.some((ok) => l.toLowerCase().includes(ok));

// 카테고리별 검색어 (Wikimedia Commons에서 잘 나오는 키워드)
const CATEGORY_QUERIES = {
  animals: [
    "funny cat portrait",
    "dog portrait expressive",
    "penguin standing",
    "fox wild",
    "owl bird portrait",
    "rabbit cute portrait",
    "bear wildlife",
    "duck bird",
    "squirrel",
    "frog close-up",
    "horse portrait",
    "parrot colorful",
    "hamster",
    "deer wildlife",
    "goat funny",
  ],
  nature: [
    "waterfall dramatic",
    "lightning storm",
    "volcano eruption",
    "tornado storm",
    "iceberg arctic",
    "aurora borealis night",
    "mushroom forest",
    "desert sand dunes",
    "coral reef underwater",
    "geyser yellowstone",
    "cave stalactite",
    "glacier mountain",
  ],
  people: [
    "vintage portrait historical",
    "caricature portrait painting",
    "historical figure portrait",
    "old photograph portrait 19th century",
    "folk art portrait painting",
    "medieval portrait painting",
    "baroque portrait painting",
    "funny expression portrait painting",
  ],
  other: [
    "vintage advertisement poster",
    "antique mechanical device",
    "old map historical",
    "vintage toy",
    "historical costume fashion",
    "medieval weapon armor",
    "ancient sculpture",
    "industrial machine vintage",
    "food vintage illustration",
  ],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Wikimedia Commons 검색 (generator=search로 이미지 파일만)
async function searchWikiImages(query, limit = 20) {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: "6",
    gsrlimit: String(limit),
    prop: "imageinfo",
    iiprop: "url|extmetadata|size",
    iiurlwidth: "800",
    format: "json",
    origin: "*",
  });
  const r = await fetch(`${WIKI_API}?${params}`);
  if (!r.ok) return [];
  const d = await r.json();
  return Object.values(d.query?.pages ?? {});
}

function extractImageData(page) {
  const info = page.imageinfo?.[0];
  if (!info) return null;

  const meta = info.extmetadata ?? {};
  const license = meta.LicenseShortName?.value ?? meta.License?.value ?? "";
  if (!isOkLicense(license)) return null;

  const url = info.thumburl || info.url;
  if (!url) return null;

  // SVG, animated GIF, tiny images 제외
  if (url.endsWith(".svg") || url.endsWith(".SVG")) return null;
  if (info.width && info.width < 400) return null;
  if (info.height && info.height < 300) return null;

  const sourceUrl = `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(page.title.replace("File:", ""))}`;
  const licenseShort = license.toLowerCase().includes("cc0") || license.toLowerCase().includes("public domain") ? "CC0" : "CC-BY";

  return { url, sourceUrl, license: licenseShort };
}

async function getExistingUrls() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/images?select=source_url&limit=2000`,
    { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } }
  );
  const data = await res.json();
  return new Set((data || []).map((r) => r.source_url));
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
  console.log("🌍 Wikimedia Commons 다양한 이미지 시드 시작\n");

  const existingUrls = await getExistingUrls();
  console.log(`기존 이미지: ${existingUrls.size}장\n`);

  const TARGET_PER_CATEGORY = 30;
  const totals = {};

  for (const [category, queries] of Object.entries(CATEGORY_QUERIES)) {
    console.log(`\n📂 카테고리: ${category}`);
    let catCount = 0;

    for (const query of queries) {
      if (catCount >= TARGET_PER_CATEGORY) break;

      await sleep(300);
      let pages;
      try {
        pages = await searchWikiImages(query, 30);
      } catch {
        console.log(`  ⚠️  "${query}" 검색 실패, 스킵`);
        continue;
      }

      for (const page of pages) {
        if (catCount >= TARGET_PER_CATEGORY) break;

        const imgData = extractImageData(page);
        if (!imgData) continue;
        if (existingUrls.has(imgData.sourceUrl)) continue;

        const ok = await insertImage({
          url: imgData.url,
          source: "WIKIMEDIA",
          license: imgData.license,
          source_url: imgData.sourceUrl,
          category,
          active: true,
        });

        if (ok) {
          existingUrls.add(imgData.sourceUrl);
          catCount++;
          process.stdout.write(`\r  "${query}": ${catCount}/${TARGET_PER_CATEGORY}장`);
        }
        await sleep(100);
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
