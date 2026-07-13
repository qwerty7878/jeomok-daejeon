import OpenAI from "openai";
import { createServerClient } from "@/lib/supabase/server";

const FALLBACK_TITLES = [
  "나도 몰랐어요", "대충 살다 보면", "설마 이게 최선?", "어쩌다 보니",
  "이럴 줄 몰랐지", "뭐 어쩌라고", "솔직히 말하면", "참을 수가 없어",
  "한 번만 더 해봐", "못 본 척했어", "괜찮다고 했잖아", "기다리다 지쳤어",
  "사실은 나야", "왜 그랬을까", "그러게 내가 뭐랬어", "이미 늦었어요",
  "됐고 그냥 가자", "알면서 모른 척", "이게 나야", "어딜 보는 거야",
];

function fallback(): string {
  return FALLBACK_TITLES[Math.floor(Math.random() * FALLBACK_TITLES.length)];
}

// GPT-4o-mini로 이미지를 보고 재미있는 제목 생성 (비전 지원 + 저렴)
export async function generateBotTitle(imageUrl: string | null): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !imageUrl) return fallback();

  try {
    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 60,
      messages: [
        {
          role: "system",
          content: "너는 사진 제목 짓기 파티 게임의 참가자야. 사진을 보고 예상 밖의 반전, 공감 가는 상황, 혹은 한국 인터넷 밈 감성의 웃긴 제목을 짓는 게 목표야. 진지한 묘사는 절대 금지. 짧고 강렬하게.",
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: imageUrl, detail: "low" },
            },
            {
              type: "text",
              text: "이 사진에 웃긴 한국어 제목 하나만 붙여줘. 15자 이내, 따옴표 없이, 제목만. 예시 스타일: '나 지금 늦었잖아', '이게 바로 현실', '아 몰라 그냥 가', '봐도 모르겠음'",
            },
          ],
        },
      ],
    });

    const text = response.choices[0]?.message?.content?.trim().replace(/^["']+|["']+$/g, "").slice(0, 40) ?? null;
    return text && text.length > 0 ? text : fallback();
  } catch {
    return fallback();
  }
}

// 방의 현재 이미지 URL 조회
export async function getRoomImageUrl(roomId: string, currentImageId: string | null): Promise<string | null> {
  if (!currentImageId) return null;
  const db = createServerClient();
  const { data } = await db.from("images").select("url").eq("id", currentImageId).single() as { data: { url: string } | null };
  return data?.url ?? null;
}
