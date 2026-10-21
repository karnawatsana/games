"use client";
import { useActionState, useState } from "react";
import { signIn, signUp } from "./actions";

type State = { error?: string; notice?: string } | undefined;

export function AuthForm({ next }: { next: string }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [state, action, pending] = useActionState<State, FormData>(mode === "in" ? signIn : signUp, undefined);
  return (
    <form action={action} className="card bg-cream" style={{ display: "grid", gap: 12 }}>
      <input type="hidden" name="next" value={next} />
      {mode === "up" && (<>
        <label className="field"><span>Display name</span><input name="displayName" required maxLength={40} autoComplete="name" /></label>
        <label className="field"><span>Username</span><input name="username" required pattern="[a-zA-Z0-9_.]{3,24}" autoComplete="username" placeholder="your Krillion handle works well" /></label>
      </>)}
      <label className="field"><span>Email</span><input name="email" type="email" required autoComplete="email" /></label>
      <label className="field"><span>Password</span><input name="password" type="password" required minLength={8} autoComplete={mode === "in" ? "current-password" : "new-password"} /></label>
      {state?.error && <p role="alert" style={{ color: "#a02a1f", fontSize: 14, fontWeight: 600 }}>{state.error}</p>}
      {state?.notice && <p role="status" style={{ fontSize: 14, fontWeight: 600 }}>{state.notice}</p>}
      <button className="btn" disabled={pending} style={{ height: 52 }}>{pending ? "One moment…" : mode === "in" ? "Sign in" : "Create account"}</button>
      <button type="button" className="muted" style={{ color: "var(--charcoal)", opacity: .7, fontWeight: 600 }} onClick={() => setMode(mode === "in" ? "up" : "in")}>
        {mode === "in" ? "New here? Create an account" : "Have an account? Sign in"}
      </button>
    </form>
  );
}
