"use client";
import { useActionState } from "react";

export default function CreateGroupForm({ action }: { action: (s: { error?: string } | undefined, f: FormData) => Promise<{ error?: string } | undefined> }) {
  const [state, run, pending] = useActionState(action, undefined);
  return (
    <form action={run} className="card bg-cream" style={{ display: "grid", gap: 12 }}>
      <h2 className="serif" style={{ fontSize: 32 }}>Start a group</h2>
      <label className="field"><span>Group name</span><input name="name" required minLength={2} maxLength={40} placeholder="Sunday crew" /></label>
      {state?.error ? <p role="alert" style={{ fontWeight: 700, color: "#a02a1f" }}>{state.error}</p> : null}
      <button className="btn" disabled={pending} style={{ height: 52 }}>{pending ? "Creating…" : "Create group"}</button>
    </form>
  );
}
