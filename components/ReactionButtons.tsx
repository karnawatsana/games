"use client";
import { useState, useTransition } from "react";
import { setMysteryReaction } from "@/app/actions/results";

const opts = [["loved", "Loved it"], ["okay", "It was okay"], ["not_for_me", "Not for me"]] as const;

export default function ReactionButtons({ date, current }: { date: string; current?: string }) {
  const [sel, setSel] = useState(current);
  const [pending, start] = useTransition();
  return (
    <div className="chips" style={{ margin: 0, padding: 0 }} role="group" aria-label="How was today's mystery game?">
      {opts.map(([k, l]) => (
        <button key={k} className={`chip ${sel === k ? "active" : ""}`} disabled={pending} aria-pressed={sel === k}
          style={sel === k ? undefined : { background: "rgb(32 33 32 / .12)", color: "var(--charcoal)" }}
          onClick={() => start(async () => { const r = await setMysteryReaction(date, k); if (r.ok) setSel(k); })}>{l}</button>
      ))}
    </div>
  );
}
