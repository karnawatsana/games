import Link from "next/link";
import Avatar from "@/components/Avatar";
import { byPlayer, byQuestion, type AnswerRow } from "@/lib/compare";

export type Person = { id: string; name: string; avatarUrl?: string };
const palette = ["coral", "butter", "mint", "sky", "lavender", "lime", "coral"];

export default function CompareView({ rows, people, view, baseHref }: { rows: AnswerRow[]; people: Person[]; view: "question" | "player"; baseHref: string }) {
  const who = (id: string) => people.find((p) => p.id === id) ?? { id, name: "Player" };
  const sep = baseHref.includes("?") ? "&" : "?";
  return (
    <>
      <div className="chips" role="tablist">
        <Link role="tab" aria-selected={view === "question"} className={`chip ${view === "question" ? "active" : ""}`} href={`${baseHref}${sep}view=question`}>By question</Link>
        <Link role="tab" aria-selected={view === "player"} className={`chip ${view === "player" ? "active" : ""}`} href={`${baseHref}${sep}view=player`}>By player</Link>
      </div>

      {view === "question" ? byQuestion(rows).map((q) => (
        <section key={q.questionNumber} className={`card bg-${palette[q.questionNumber - 1]}`} style={{ display: "grid", gap: 12 }}>
          <div><span className="label">Question {q.questionNumber}</span><p style={{ fontWeight: 700, fontSize: 15, marginTop: 6, textTransform: "uppercase", letterSpacing: ".02em" }}>{q.questionText}</p></div>
          {q.entries.map((e) => { const p = who(e.userId); return (
            <div key={e.userId} className="flex items-center gap-3" style={{ background: "rgb(255 255 255 / .5)", borderRadius: 18, padding: "10px 12px" }}>
              <Avatar name={p.name} url={(p as Person).avatarUrl} id={p.id} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 17, overflowWrap: "anywhere" }}>{e.answerText}</div>
                <div style={{ fontSize: 12, fontWeight: 600, opacity: .65 }}>{p.name}{e.matchCount > 1 ? ` · ${e.matchCount} gave this` : ""}{e.rarity ? ` · ${e.rarity}` : ""}</div>
              </div>
              {e.top && <span className="tag" style={{ background: "var(--charcoal)", color: "var(--cream)" }}>Top</span>}
              <span className="pts" style={{ fontSize: 24 }}>{e.points}</span>
            </div>); })}
        </section>
      )) : byPlayer(rows).map((pl, i) => { const p = who(pl.userId); return (
        <section key={pl.userId} className={`card bg-${palette[i % palette.length]}`} style={{ display: "grid", gap: 10 }}>
          <div className="flex items-center gap-3"><Avatar name={p.name} url={(p as Person).avatarUrl} id={p.id} /><b style={{ flex: 1, fontSize: 18 }}>{p.name}</b><span className="serif" style={{ fontSize: 44, lineHeight: 1 }}>{pl.total}</span></div>
          {pl.answers.map((a) => (
            <div key={a.questionNumber} className="flex items-baseline gap-3" style={{ background: "rgb(255 255 255 / .5)", borderRadius: 16, padding: "8px 12px" }}>
              <span className="label">{a.questionNumber}</span><span style={{ flex: 1, fontWeight: 700, overflowWrap: "anywhere" }}>{a.answerText}</span><b>{a.points}</b>
            </div>))}
        </section>); })}
    </>
  );
}
