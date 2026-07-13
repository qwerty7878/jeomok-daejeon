import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { err, ok } from "@/lib/api-helpers";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const BUCKET = "library-images";
const SOURCES = ["AI", "USER"] as const;
const LICENSES = ["OWN", "CC0", "PD", "KOGL-1"] as const;
const CATEGORIES = ["art", "nature", "people", "animals", "other"] as const;

function isAdmin(req: NextRequest): boolean {
  return req.headers.get("x-admin-secret") === process.env.ADMIN_SECRET;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return err("UNAUTHORIZED", "관리자 권한이 필요합니다", 401);

  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const limit = 30;
  const offset = (page - 1) * limit;

  const db = createServerClient();
  const { data, count, error } = await db
    .from("images")
    .select("id,url,source,license,source_url,category,active,exposures,vote_variance,created_at", { count: "exact" })
    .is("room_id", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return err("DB_ERROR", error.message, 500);
  return ok({ images: data ?? [], total: count ?? 0, page, limit });
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return err("UNAUTHORIZED", "관리자 권한이 필요합니다", 401);

  const db = createServerClient();

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const source = formData.get("source") as string | null;
  const license = formData.get("license") as string | null;
  const sourceUrl = formData.get("source_url") as string | null;
  const category = (formData.get("category") as string | null) ?? "other";
  const era = (formData.get("era") as string | null) || null;

  if (!file) return err("NO_FILE", "파일이 없습니다", 400);
  if (!ALLOWED.includes(file.type)) return err("INVALID_TYPE", "JPG/PNG/WebP만 허용됩니다", 400);
  if (file.size > MAX_BYTES) return err("TOO_LARGE", "8MB 이하만 업로드 가능합니다", 400);
  if (!source || !SOURCES.includes(source as typeof SOURCES[number])) {
    return err("INVALID_SOURCE", `source는 ${SOURCES.join("/")} 중 하나여야 합니다`, 400);
  }
  if (!license || !LICENSES.includes(license as typeof LICENSES[number])) {
    return err("INVALID_LICENSE", `license는 ${LICENSES.join("/")} 중 하나여야 합니다`, 400);
  }
  // docs/content.md: source_url 없으면 등록 금지 (공공누리 출처표시 의무 대비)
  if (!sourceUrl) return err("MISSING_SOURCE_URL", "source_url은 필수입니다", 400);
  if (!CATEGORIES.includes(category as typeof CATEGORIES[number])) {
    return err("INVALID_CATEGORY", `category는 ${CATEGORIES.join("/")} 중 하나여야 합니다`, 400);
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  let { error: uploadErr } = await db.storage.from(BUCKET).upload(filename, buf, {
    contentType: file.type,
    upsert: false,
  });

  if (uploadErr?.message?.includes("Bucket not found")) {
    await db.storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_BYTES });
    const retry = await db.storage.from(BUCKET).upload(filename, buf, {
      contentType: file.type,
      upsert: false,
    });
    uploadErr = retry.error;
  }

  if (uploadErr) return err("UPLOAD_FAILED", uploadErr.message, 500);

  const { data: urlData } = db.storage.from(BUCKET).getPublicUrl(filename);

  const { data: img, error: insertErr } = await db
    .from("images")
    .insert({
      url: urlData.publicUrl,
      source,
      license,
      source_url: sourceUrl,
      category,
      era,
      room_id: null,
      active: true,
    })
    .select("id,url")
    .single() as { data: { id: string; url: string } | null; error: unknown };

  if (insertErr || !img) return err("DB_ERROR", "이미지 저장 실패", 500);

  return ok({ id: img.id, url: img.url }, 201);
}

export async function PATCH(req: NextRequest) {
  if (!isAdmin(req)) return err("UNAUTHORIZED", "관리자 권한이 필요합니다", 401);

  const body = await req.json().catch(() => ({})) as { id?: string; active?: boolean };
  if (!body.id || typeof body.active !== "boolean") {
    return err("INVALID_BODY", "id and active required", 400);
  }

  const db = createServerClient();
  const { error } = await db.from("images").update({ active: body.active }).eq("id", body.id).is("room_id", null);
  if (error) return err("DB_ERROR", error.message, 500);

  return ok({ updated: true });
}
