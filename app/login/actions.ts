"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const safeNext = (n: FormDataEntryValue | null) => (typeof n === "string" && n.startsWith("/") && !n.startsWith("//") ? n : "/");
const Creds = z.object({ email: z.string().email(), password: z.string().min(8, "Password needs at least 8 characters") });

export async function signIn(_: unknown, form: FormData) {
  const p = Creds.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!p.success) return { error: p.error.issues[0].message };
  const sb = await createClient();
  const { error } = await sb.auth.signInWithPassword(p.data);
  if (error) return { error: "That email and password don't match." };
  redirect(safeNext(form.get("next")));
}

export async function signUp(_: unknown, form: FormData) {
  const p = Creds.extend({ username: z.string().regex(/^[a-zA-Z0-9_.]{3,24}$/, "Username: 3–24 letters, numbers, _ or ."), displayName: z.string().min(1).max(40) })
    .safeParse({ email: form.get("email"), password: form.get("password"), username: form.get("username"), displayName: form.get("displayName") });
  if (!p.success) return { error: p.error.issues[0].message };
  const sb = await createClient();
  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL;
  const { data, error } = await sb.auth.signUp({
    email: p.data.email, password: p.data.password,
    options: { data: { username: p.data.username.toLowerCase(), display_name: p.data.displayName }, emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNext(form.get("next")))}` },
  });
  if (error) return { error: error.message };
  if (!data.session) return { notice: "Check your email to confirm your account, then sign in." };
  redirect(safeNext(form.get("next")));
}

export async function signOut() {
  const sb = await createClient();
  await sb.auth.signOut();
  redirect("/login");
}
