"use server";
import { randomBytes, createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export async function createGroup(_: { error?: string } | undefined, form: FormData): Promise<{ error?: string } | undefined> {
  const name = z.string().trim().min(2).max(40).safeParse(form.get("name"));
  if (!name.success) return { error: "Give the group a name (2–40 characters)." };
  const sb = await createClient();
  const { data, error } = await sb.rpc("create_group", { group_name: name.data });
  if (error) return { error: "Couldn't create the group." };
  revalidatePath("/groups");
  redirect(`/groups/${data}`);
}

/** Returns the invite URL once. Only a hash of the token is stored. */
export async function createInvite(groupId: string): Promise<{ url?: string; error?: string }> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: "Sign in first." };
  const token = randomBytes(24).toString("base64url");
  const { error } = await sb.from("group_invites").insert({
    group_id: groupId, created_by: user.id, token_hash: createHash("sha256").update(token).digest("hex"),
    expires_at: new Date(Date.now() + 7 * 864e5).toISOString(), max_uses: 25,
  });
  if (error) return { error: "Only the group owner can create invites." };
  return { url: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/join/${token}` };
}

export async function joinGroup(token: string) {
  const sb = await createClient();
  const { data, error } = await sb.rpc("join_group_with_token", { token });
  if (error) return { error: "This invite is invalid or has expired." };
  revalidatePath("/groups");
  redirect(`/groups/${data}`);
}

export async function leaveGroup(groupId: string) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;
  await sb.from("group_members").delete().eq("group_id", groupId).eq("user_id", user.id);
  revalidatePath("/groups");
  redirect("/groups");
}

export async function createChallenge(groupId: string, kind: "total_games" | "everyone_finishes_today" | "daily_threes_in_week", target: number, startsOn: string, endsOn: string) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false as const };
  const { error } = await sb.from("group_challenges").insert({ group_id: groupId, kind, target, starts_on: startsOn, ends_on: endsOn, created_by: user.id });
  revalidatePath(`/groups/${groupId}`);
  return { ok: !error as boolean };
}
