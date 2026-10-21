"use client";
import { useState, useTransition } from "react";
import { createInvite } from "@/app/actions/groups";

export default function InviteButton({ groupId }: { groupId: string }) {
  const [url, setUrl] = useState<string>();
  const [err, setErr] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <button className="btn" disabled={pending} onClick={() => start(async () => { const r = await createInvite(groupId); setUrl(r.url); setErr(r.error); setCopied(false); })}>
        {pending ? "Creating…" : url ? "New invite link" : "Create invite link"}
      </button>
      {url && (
        <div className="empty" style={{ background: "rgb(32 33 32 / .1)", color: "var(--charcoal)", wordBreak: "break-all" }}>
          <div style={{ fontWeight: 600 }}>{url}</div>
          <button className="tag" style={{ marginTop: 8 }} onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); }}>{copied ? "Copied" : "Copy link"}</button>
          <p style={{ fontSize: 12, marginTop: 6, opacity: .7 }}>Works for 7 days, up to 25 people. Shown once.</p>
        </div>)}
      {err && <p role="alert" style={{ fontWeight: 700, fontSize: 14 }}>{err}</p>}
    </div>
  );
}
