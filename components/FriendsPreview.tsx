"use client";
import { useState } from "react";
import Link from "next/link";
import type { DailyState } from "@/lib/types";

const tints = ["var(--lime)", "var(--butter, #ffd16a)", "var(--coral)", "var(--mint)", "var(--sky)", "var(--lavender)"];

export default function FriendsPreview({ groups, signedIn }: { groups: DailyState["groups"]; signedIn: boolean }) {
  const [gid, setGid] = useState(groups[0]?.id);
  const group = groups.find((g) => g.id === gid);

  if (!signedIn) {
    return (
      <section className="friends">
        <h2 className="serif" style={{ fontSize: 34 }}>Better <em>together.</em></h2>
        <p className="muted" style={{ margin: "8px 0 16px" }}>Sign in to log results and see how your friends are doing today.</p>
        <Link href="/login" className="btn" style={{ background: "var(--lime)", color: "var(--charcoal)" }}>Sign in or join</Link>
      </section>
    );
  }
  if (!group) {
    return (
      <section className="friends">
        <h2 className="serif" style={{ fontSize: 34 }}>Play with <em>friends.</em></h2>
        <div className="empty" style={{ margin: "12px 0 16px" }}>You’re not in a group yet. Start one and send the invite link.</div>
        <Link href="/groups" className="btn" style={{ background: "var(--lime)", color: "var(--charcoal)" }}>Create or join a group</Link>
      </section>
    );
  }
  const finished = group.members.filter((m) => m.completed === 3);
  const top = [...group.members].sort((a, b) => b.completed - a.completed).slice(0, 3);
  return (
    <section className="friends">
      <div className="board-title">
        <h2 className="serif">Friends <em>today</em></h2>
        {groups.length > 1 && (
          <select className="select" value={gid} onChange={(e) => setGid(e.target.value)} aria-label="Group">
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        )}
      </div>
      {group.members.length <= 1 ? (
        <div className="empty">Just you so far. Invite someone to {group.name}.</div>
      ) : (
        <>
          <div className="flex items-center gap-3" style={{ margin: "4px 0 14px" }}>
            <div className="stack">
              {group.members.slice(0, 5).map((m, i) => <span className="pfp" key={m.id} style={{ background: tints[i % tints.length] }}>{m.name[0].toUpperCase()}</span>)}
            </div>
            <span className="muted">{finished.length} of {group.members.length} finished all three</span>
          </div>
          {top.map((m, i) => (
            <div className="row" key={m.id}>
              <span className="rank">{i + 1}</span>
              <span className="pfp" style={{ background: tints[i % tints.length] }}>{m.name[0].toUpperCase()}</span>
              <span className="who"><b>{m.name}</b></span>
              <span className="pts">{m.completed}<span className="muted">/3</span></span>
            </div>
          ))}
        </>
      )}
      <Link href={`/groups/${group.id}`} className="muted" style={{ display: "inline-block", marginTop: 12, fontWeight: 600 }}>Open leaderboards →</Link>
    </section>
  );
}
