import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { err, ok, getSessionId } from "@/lib/api-helpers";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const BUCKET = "room-images";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const sessionId = getSessionId(req);
  if (!sessionId) return err("MISSING_SESSION", "x-session-id required");

  const db = createServerClient();

  const { data: room } = await db
    .from("rooms")
    .select("id,phase,image_source")
    .eq("code", code.toUpperCase())
    .single() as { data: { id: string; phase: string; image_source: string } | null };

  if (!room) return err("ROOM_NOT_FOUND", "존재하지 않는 방입니다", 404);
  if (room.phase !== "WAITING") return err("PHASE_MISMATCH", "대기 중에만 업로드 가능합니다", 400);
  if (room.image_source !== "CUSTOM") return err("NOT_CUSTOM", "커스텀 이미지 모드가 아닙니다", 400);

  const { data: player } = await db
    .from("players")
    .select("id,is_host:id")
    .eq("room_id", room.id)
    .eq("session_id", sessionId)
    .single() as { data: { id: string } | null };

  if (!player) return err("NOT_IN_ROOM", "이 방의 플레이어가 아닙니다", 403);

  // host 확인
  const { data: roomHost } = await db
    .from("rooms").select("host_id").eq("id", room.id).single() as { data: { host_id: string | null } | null };
  if (roomHost?.host_id !== player.id) return err("NOT_HOST", "방장만 업로드할 수 있습니다", 403);

  // 기존 업로드 수 확인 (최대 20장)
  const { count: existing } = await db
    .from("images").select("*", { count: "exact", head: true })
    .eq("room_id", code.toUpperCase());
  if ((existing ?? 0) >= 20) return err("TOO_MANY", "최대 20장까지 업로드 가능합니다", 400);

  // 파일 파싱
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return err("NO_FILE", "파일이 없습니다", 400);
  if (!ALLOWED.includes(file.type)) return err("INVALID_TYPE", "JPG/PNG/WebP/GIF만 허용됩니다", 400);
  if (file.size > MAX_BYTES) return err("TOO_LARGE", "5MB 이하만 업로드 가능합니다", 400);

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const filename = `${code.toUpperCase()}/${Date.now()}.${ext}`;

  let { error: uploadErr } = await db.storage.from(BUCKET).upload(filename, buf, {
    contentType: file.type,
    upsert: false,
  });

  // 버킷이 없으면 자동 생성 후 재시도
  if (uploadErr?.message === "Bucket not found" || uploadErr?.message?.includes("Bucket not found")) {
    await db.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 5 * 1024 * 1024 });
    const retry = await db.storage.from(BUCKET).upload(filename, buf, {
      contentType: file.type,
      upsert: false,
    });
    uploadErr = retry.error;
  }

  if (uploadErr) return err("UPLOAD_FAILED", uploadErr.message, 500);

  const { data: urlData } = db.storage.from(BUCKET).getPublicUrl(filename);
  const url = urlData.publicUrl;

  const { data: img, error: insertErr } = await db
    .from("images")
    .insert({
      url,
      source: "USER",
      license: "OWN",
      source_url: url,
      category: "other",
      room_id: code.toUpperCase(),
      active: true,
    })
    .select("id,url")
    .single() as { data: { id: string; url: string } | null; error: unknown };

  if (insertErr || !img) return err("DB_ERROR", "이미지 저장 실패", 500);

  return ok({ id: img.id, url: img.url }, 201);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const sessionId = getSessionId(req);
  if (!sessionId) return err("MISSING_SESSION", "x-session-id required");

  const db = createServerClient();
  const { data: images } = await db
    .from("images")
    .select("id,url")
    .eq("room_id", code.toUpperCase())
    .order("created_at", { ascending: true }) as { data: Array<{ id: string; url: string }> | null };

  return ok({ images: images ?? [] });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const sessionId = getSessionId(req);
  if (!sessionId) return err("MISSING_SESSION", "x-session-id required");

  const db = createServerClient();
  const body = await req.json() as { id: string };
  if (!body.id) return err("MISSING_ID", "id required", 400);

  const { data: room } = await db
    .from("rooms").select("id,host_id,phase")
    .eq("code", code.toUpperCase()).single() as { data: { id: string; host_id: string | null; phase: string } | null };

  if (!room || room.phase !== "WAITING") return err("PHASE_MISMATCH", "대기 중에만 삭제 가능합니다", 400);

  const { data: player } = await db
    .from("players").select("id")
    .eq("room_id", room.id).eq("session_id", sessionId).single() as { data: { id: string } | null };
  if (!player || room.host_id !== player.id) return err("NOT_HOST", "방장만 삭제할 수 있습니다", 403);

  await db.from("images").delete().eq("id", body.id).eq("room_id", code.toUpperCase());

  return ok({ deleted: true });
}
