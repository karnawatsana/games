import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { ALLOWED_TYPES, MAX_UPLOAD_BYTES } from "@/lib/krillion/image";
import { extractKrillion, ExtractionError } from "@/lib/krillion/extract";
import { validateExtraction } from "@/lib/krillion/validate";

export const runtime = "nodejs";
export const maxDuration = 60;

const PER_HOUR = Number(process.env.EXTRACTIONS_PER_HOUR ?? 10);
const PER_DAY = Number(process.env.EXTRACTIONS_PER_DAY ?? 30);

export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("image");
  if (!(file instanceof File)) return NextResponse.json({ error: "Attach a screenshot." }, { status: 400 });
  if (!(ALLOWED_TYPES as readonly string[]).includes(file.type)) return NextResponse.json({ error: "Use a PNG, JPEG or WebP image." }, { status: 415 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "That image is over 10 MB." }, { status: 413 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Screenshot reading isn't set up yet. You can still paste your score." }, { status: 503 });

  // Quota (service role: the log is not writable by users)
  const admin = createAdminClient();
  const since = (ms: number) => new Date(Date.now() - ms).toISOString();
  const [{ count: hour }, { count: day }] = await Promise.all([
    admin.from("extraction_events").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since(3600e3)),
    admin.from("extraction_events").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since(86400e3)),
  ]);
  if ((hour ?? 0) >= PER_HOUR || (day ?? 0) >= PER_DAY) return NextResponse.json({ error: "You've hit today's screenshot limit. Try again later or paste your score." }, { status: 429 });
  await admin.from("extraction_events").insert({ user_id: user.id });

  const buf = Buffer.from(await file.arrayBuffer());
  const { data: profile } = await sb.from("profiles").select("username").eq("id", user.id).single();

  // Keep the original, private, under the user's own folder.
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const storagePath = `${user.id}/${randomUUID()}.${ext}`;
  const up = await sb.storage.from("result-screenshots").upload(storagePath, buf, { contentType: file.type });

  try {
    const extraction = await extractKrillion(buf, { expectedHandle: profile?.username });
    const { issues } = validateExtraction(extraction, { username: profile?.username });
    return NextResponse.json({ extraction, issues, storagePath: up.error ? null : storagePath });
  } catch (e) {
    const msg = e instanceof ExtractionError ? e.message : "We couldn't read that screenshot.";
    return NextResponse.json({ error: msg + " You can try again or enter the score by hand." }, { status: 502 });
  }
}
