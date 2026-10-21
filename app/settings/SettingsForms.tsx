"use client";
import { useActionState, useState, useTransition } from "react";
import { updateProfile, deleteAccount } from "@/app/actions/profile";
import { signOut } from "@/app/login/actions";
import Avatar from "@/components/Avatar";

type P = { display_name: string; username: string; share_answers: boolean; avatarUrl?: string };

export default function SettingsForms({ profile }: { profile: P }) {
  const [state, run, pending] = useActionState(updateProfile as (s: unknown, f: FormData) => Promise<{ error?: string; ok?: boolean }>, undefined);
  const [confirm, setConfirm] = useState(false);
  const [deleting, start] = useTransition();
  return (
    <>
      <form action={run} className="card bg-cream" style={{ display: "grid", gap: 12 }}>
        <div className="flex items-center gap-3"><Avatar name={profile.display_name} url={profile.avatarUrl} size={56} />
          <label className="field" style={{ flex: 1 }}><span>Profile photo</span><input type="file" name="avatar" accept="image/png,image/jpeg,image/webp" style={{ height: "auto", padding: 10 }} /></label></div>
        <label className="field"><span>Display name</span><input name="display_name" defaultValue={profile.display_name} required maxLength={40} /></label>
        <label className="field"><span>Username</span><input name="username" defaultValue={profile.username} required pattern="[a-zA-Z0-9_.]{3,24}" /></label>
        <label className="flex items-center gap-3" style={{ fontWeight: 600, fontSize: 14 }}><input type="checkbox" name="share_answers" defaultChecked={profile.share_answers} style={{ width: 20, height: 20 }} />
          Let group members see my Krillion answers (after they’ve played)</label>
        {state?.error && <p role="alert" style={{ color: "#a02a1f", fontWeight: 700 }}>{state.error}</p>}
        {state?.ok && <p role="status" style={{ fontWeight: 700 }}>Saved.</p>}
        <button className="btn" disabled={pending} style={{ height: 52 }}>{pending ? "Saving…" : "Save changes"}</button>
      </form>
      <form action={signOut}><button className="btn btn-ghost" style={{ background: "var(--charcoal-2)", color: "var(--cream)", width: "100%" }}>Sign out</button></form>
      <section className="friends"><h2 className="serif" style={{ fontSize: 30 }}>Delete my account</h2>
        <p className="muted" style={{ margin: "8px 0 14px" }}>Removes your profile, results, answers, screenshots and group memberships. This can’t be undone.</p>
        {!confirm ? <button className="btn" style={{ background: "var(--coral)", color: "var(--charcoal)" }} onClick={() => setConfirm(true)}>Delete account…</button> :
          <div className="flex gap-2"><button className="btn" style={{ background: "var(--coral)", color: "var(--charcoal)", flex: 1 }} disabled={deleting} onClick={() => start(async () => { await deleteAccount(); window.location.href = "/login"; })}>{deleting ? "Deleting…" : "Yes, delete everything"}</button>
            <button className="btn btn-ghost" style={{ background: "var(--charcoal-3)", color: "var(--cream)" }} onClick={() => setConfirm(false)}>Cancel</button></div>}
      </section>
    </>
  );
}
