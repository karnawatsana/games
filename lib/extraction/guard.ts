import "server-only";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { ALLOWED_TYPES, MAX_UPLOAD_BYTES } from "@/lib/krillion/image";

const PER_HOUR = Number(process.env.EXTRACTIONS_PER_HOUR ?? 10);
const PER_DAY = Number(process.env.EXTRACTIONS_PER_DAY ?? 30);

/** Auth, upload validation, quota, and private storage of the original. Shared by every screenshot extractor. */
export async function guardExtraction(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const fail = (error: string, status: number) => ({ res: NextResponse.json({ error }, { status }) });
  if (!user) return fail("Sign in first.", 401);

  const form = await req.formData().catch(() => null);
  const file = form?.get("image");
  if (!(file instanceof File)) return fail("Attach a screenshot.", 400);
  if (!(ALLOWED_TYPES as readonly string[]).includes(file.type)) return fail("Use a PNG, JPEG or WebP image.", 415);
  if (file.size > MAX_UPLOAD_BYTES) return fail("That image is over 10 MB.", 413);
  if (!process.env.ANTHROPIC_API_KEY) return fail("Screenshot reading isn't set up yet. You can still paste your result.", 503);

  const admin = createAdminClient();
  const since = (ms: number) => new Date(Date.now() - ms).toISOString();
  const [{ count: hour }, { count: day }] = await Promise.all([
    admin.from("extraction_events").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since(3600e3)),
    admin.from("extraction_events").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since(86400e3)),
  ]);
  if ((hour ?? 0) >= PER_HOUR || (day ?? 0) >= PER_DAY) return fail("You've hit today's screenshot limit. Try again later or paste your result.", 429);
  await admin.from("extraction_events").insert({ user_id: user.id });

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${user.id}/${randomUUID()}.${ext}`;
  const up = await sb.storage.from("result-screenshots").upload(path, buf, { contentType: file.type });
  const { data: profile } = await sb.from("profiles").select("username").eq("id", user.id).single();
  return { ok: { sb, user, buf, username: profile?.username as string | undefined, storagePath: up.error ? null : path } };
}
