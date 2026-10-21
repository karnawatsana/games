"use client";
import { useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Arrow, Check, Play, Sparkle } from "./Icons";
import type { DailyState } from "@/lib/types";

type Props = { mystery: DailyState["mystery"]; signedIn: boolean; onReveal?: () => Promise<DailyState["mystery"]["game"]> };

export default function MysteryCard({ mystery, signedIn, onReveal }: Props) {
  const reduce = useReducedMotion();
  const [revealed, setRevealed] = useState(mystery.revealed || mystery.result.completed);
  const [pending, start] = useTransition();
  const [g, setG] = useState(mystery.game);

  const reveal = () => {
    // the global selection is never changed by this; only this user's reveal state is stored
    start(async () => { const game = onReveal ? await onReveal() : g; if (game) { setG(game); setRevealed(true); } });
  };

  return (
    <article className="gc bg-lavender" aria-label="Today's mystery game" style={{ minHeight: 260 }}>
      <div className="gc-deco" aria-hidden />
      <AnimatePresence mode="wait" initial={false}>
        {!revealed || !g ? (
          <motion.div key="closed" exit={reduce ? undefined : { opacity: 0, y: -12 }} className="flex flex-col gap-5 h-full flex-1">
            <span className="mystery-q" aria-hidden>?</span>
            <div>
              <span className="label">Game 03 · Mystery</span>
              <h2>Something <em>new</em> for your brain.</h2>
              <p>{mystery.available ? "Same surprise for everyone today. Open it when you’re ready." : "Today’s surprise isn’t scheduled yet. Check back soon."}</p>
            </div>
            <div className="gc-foot">
              <button className="btn" style={{ flex: 1, opacity: mystery.available ? 1 : .5 }} onClick={reveal} disabled={!mystery.available || pending}>
                <Sparkle size={18} /> Reveal today’s game
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="open" initial={reduce ? false : { opacity: 0, y: 16, rotateX: -8 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ type: "spring", stiffness: 220, damping: 22 }} className="flex flex-col gap-5 flex-1">
            <div className="gc-top">
              <div>
                <span className="label">Game 03 · Today’s mystery</span>
                <h2>{g.name}</h2>
                <p>{g.description}</p>
              </div>
              {mystery.result.completed && mystery.result.scoreLabel && (
                <div className="score">{mystery.result.scoreLabel}<small>{mystery.result.scoreSuffix}</small></div>
              )}
            </div>
            <div className="gc-status-row">
              <div className="meta">
                <span className="tag">{g.category}</span>
                <span className="tag">~{g.estimatedMinutes} min</span>
              </div>
              {mystery.result.completed ? (
                <span className="status done"><Check size={14} /> {mystery.result.verification === "verified" ? "Completed" : "Marked complete"}</span>
              ) : (
                <span className="status">Not played yet</span>
              )}
            </div>
            <div className="gc-foot">
              <div className="actions">
                {!mystery.result.completed && signedIn && <a className="btn btn-ghost" href="/results?game=mystery">Add result</a>}
                <a className="btn" href={g.url} target="_blank" rel="noopener noreferrer">
                  {mystery.result.completed ? <>Open <Arrow size={18} /></> : <><Play size={16} /> Play</>}
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}
