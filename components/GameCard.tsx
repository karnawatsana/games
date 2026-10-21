import { Arrow, Check, Play } from "./Icons";
import type { GameResultSummary } from "@/lib/types";

type Props = {
  index: number;
  name: string;
  slug: string;
  tagline: string;
  url: string;
  color: "coral" | "butter" | "lavender";
  result: GameResultSummary;
  tags?: string[];
};

export default function GameCard({ index, name, slug, tagline, url, color, result, tags = [] }: Props) {
  return (
    <article className={`gc bg-${color}`} aria-label={name}>
      <div className="gc-deco" aria-hidden />
      <div className="gc-top">
        <div>
          <span className="label">Game 0{index}</span>
          <h2>{name}</h2>
          <p>{tagline}</p>
        </div>
        {result.completed && result.scoreLabel && (
          <div className="score">
            {result.scoreLabel}
            <small>{result.scoreSuffix}</small>
          </div>
        )}
      </div>
      <div className="gc-status-row">
        <div className="meta">{tags.map((t) => <span className="tag" key={t}>{t}</span>)}</div>
        {result.completed ? (
          <span className="status done"><Check size={14} /> {result.verification === "user_confirmed" ? "Marked complete" : "Completed"}</span>
        ) : (
          <span className="status">Not played yet</span>
        )}
      </div>
      <div className="gc-foot">
        <div className="actions">
          {!result.completed && <a className="btn btn-ghost" href={`/results?game=${slug}`}>Add result</a>}
          <a className="btn" href={url} target="_blank" rel="noopener noreferrer">
            {result.completed ? <>Open <Arrow size={18} /></> : <><Play size={16} /> Play</>}
          </a>
        </div>
      </div>
    </article>
  );
}
