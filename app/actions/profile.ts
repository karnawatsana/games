"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function updateProfile(_: unknown, form: FormData) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: "Sign in first." };
  const p = z.object({ display_name: z.string().trim().min(1).max(40), username: z.string().regex(/^[a-z0-9_.]{3,24}$/i), share_answers: z.boolean() })
    .safeParse({ display_name: form.get("display_name"), username: form.get("username"), share_answers: form.get("share_answers") === "on" });
  if (!p.success) return { error: "Check your name and username (3–24 letters, numbers, _ or .)." };
  const patch: Record<string, unknown> = { ...p.data, username: p.data.username.toLowerCase() };
  const file = form.get("avatar");
  if (file instanceof File && file.size > 0) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) return { error: "Profile photo must be a PNG, JPEG or WebP under 2 MB." };
    const path = `${user.id}/avatar-${Date.now()}.${file.type.split("/")[1].replace("jpeg", "jpg")}`;
    const up = await sb.storage.from("avatars").upload(path, file, { contentType: file.type });
    if (up.error) return { error: "Couldn't upload the photo." };
    patch.avatar_path = path;
  }
  const { error } = await sb.from("profiles").update(patch).eq("id", user.id);
  if (error) return { error: error.code === "23505" ? "That username is taken." : "Couldn't save your profile." };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Permanently removes the account and all its data (cascades) plus stored files. */
export async function deleteAccount() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false as const };
  const admin = createAdminClient();
  for (const bucket of ["result-screenshots", "avatars"]) {
    const { data } = await admin.storage.from(bucket).list(user.id);
    if (data?.length) await admin.storage.from(bucket).remove(data.map((f) => `${user.id}/${f.name}`));
  }
  await admin.auth.admin.deleteUser(user.id);
  await sb.auth.signOut();
  return { ok: true as const };
}
