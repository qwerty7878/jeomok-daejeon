import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { err, ok } from "@/lib/api-helpers";
import OpenAI from "openai";

const CATEGORIES = ["art", "nature", "people", "animals", "other"] as const;
type Category = typeof CATEGORIES[number];

interface ImageRow { id: string; url: string; category: string; }

async function classifyImage(client: OpenAI, url: string): Promise<Category> {
  try {
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 10,
      messages: [
        {
          role: "system",
          content: "이미지를 보고 카테고리를 딱 하나의 단어로만 답해. 선택지: art, nature, people, animals, other. 다른 말은 절대 하지 마.",
        },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url, detail: "low" } },
            {
              type: "text",
              text: "이 이미지의 주된 내용은 무엇인가? art(예술작품/그림), nature(자연/풍경/식물), people(사람/인물/군중), animals(동물), other(그 외) 중 하나만 답해.",
            },
          ],
        },
      ],
    });
    const raw = res.choices[0]?.message?.content?.trim().toLowerCase() ?? "";
    const match = CATEGORIES.find((c) => raw.includes(c));
    return match ?? "art";
  } catch {
    return "art";
  }
}

export async function POST(req: NextRequest) {
  const adminSecret = req.headers.get("x-admin-secret");
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return err("UNAUTHORIZED", "관리자 권한이 필요합니다", 401);
  }

  const body = await req.json().catch(() => ({})) as { limit?: number; dryRun?: boolean };
  const limit = Math.min(body.limit ?? 50, 200);
  const dryRun = body.dryRun ?? false;

  const db = createServerClient();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return err("NO_API_KEY", "OPENAI_API_KEY 미설정", 500);

  // 기본값(art)으로 설정된 공용 이미지만 대상 (room_id가 null인 라이브러리 이미지)
  const { data: images } = await db
    .from("images")
    .select("id,url,category")
    .is("room_id", null)
    .eq("active", true)
    .limit(limit) as { data: ImageRow[] | null };

  if (!images || images.length === 0) return ok({ classified: 0, message: "분류할 이미지 없음" });

  const client = new OpenAI({ apiKey });
  const results: Array<{ id: string; url: string; old: string; new: Category }> = [];

  // 병렬 처리 (5개씩 배치, 속도 vs API rate limit 균형)
  for (let i = 0; i < images.length; i += 5) {
    const batch = images.slice(i, i + 5);
    const classified = await Promise.all(
      batch.map(async (img) => ({
        ...img,
        newCategory: await classifyImage(client, img.url),
      }))
    );

    if (!dryRun) {
      for (const item of classified) {
        await db.from("images").update({ category: item.newCategory }).eq("id", item.id);
        results.push({ id: item.id, url: item.url, old: item.category, new: item.newCategory });
      }
    } else {
      for (const item of classified) {
        results.push({ id: item.id, url: item.url, old: item.category, new: item.newCategory });
      }
    }
  }

  const summary: Record<string, number> = {};
  for (const r of results) summary[r.new] = (summary[r.new] ?? 0) + 1;

  return ok({ classified: results.length, dryRun, summary, results });
}
