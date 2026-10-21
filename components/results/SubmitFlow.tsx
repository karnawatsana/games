"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { saveResult, type SaveResult } from "@/app/actions/results";
import { parseKrillionShare } from "@/lib/krillion/shareText";
import { parseFermiShare } from "@/lib/fermi/parse";
import { hasBlockingIssues, validateExtraction, type Issue } from "@/lib/krillion/validate";
import type { KrillionExtraction } from "@/lib/krillion/schema";
import { checkFermi, type FermiExtraction } from "@/lib/fermi/schema";
import { fermiDateForNumber } from "@/lib/fermi/parse";

type GameKey = "krillion" | "fermi" | "mystery";
type Props = { today: string; username: string; mysteryName: string | null; initialGame?: GameKey };

const prettyShort = (d: string) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(new Date(`${d}T12:00:00Z`));
const label: Record<GameKey, string> = { krillion: "Krillion", fermi: "Fermi", mystery: "Mystery" };
const statusCopy = { created: "Saved. Nice one.", enriched: "Added to your existing result.", corrected: "Result updated.", unchanged: "Already saved. Nothing changed." } as const;

export default function SubmitFlow({ today, username, mysteryName, initialGame = "krillion" }: Props) {
  const [game, setGame] = useState<GameKey>(initialGame);
  const [date, setDate] = useState(today);
  const [dateConfirmed, setDateConfirmed] = useState(true);
  const [text, setText] = useState("");
  const [manualScore, setManualScore] = useState("");
  const [mode, setMode] = useState<"text" | "screenshot">("text");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, start] = useTransition();

  // screenshot state
  const [preview, setPreview] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<KrillionExtraction | null>(null);
  const [path, setPath] = useState<string | undefined>();
  const [fermiX, setFermiX] = useState<FermiExtraction | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const issues: Issue[] = useMemo(() => (extraction ? validateExtraction(extraction, { username }).issues : []), [extraction, username]);
  const kShare = useMemo(() => (game === "krillion" && text ? parseKrillionShare(text) : null), [game, text]);
  const fShare = useMemo(() => (game === "fermi" && text ? parseFermiShare(text) : null), [game, text]);

  const onText = (v: string) => {
    setText(v);
    const p = parseFermiShare(v);
    if (game === "fermi" && p.puzzleNumber) { const d = fermiDateForNumber(p.puzzleNumber); if (d <= today) { setDate(d); setDateConfirmed(true); } }
  };
  const reset = () => { setFermiX(null); setExtraction(null); setPreview(null); setPath(undefined); setText(""); setManualScore(""); };
  const done = (r: SaveResult) => { if (r.ok) { setMsg({ kind: "ok", text: statusCopy[r.status] }); reset(); } else setMsg({ kind: "err", text: r.error }); };

  async function onFile(f: File | undefined) {
    if (!f) return;
    setMsg(null); setExtraction(null); setPreview(URL.createObjectURL(f)); setBusy(true);
    const fd = new FormData(); fd.set("image", f);
    try {
      const res = await fetch(`/api/extract/${game === "fermi" ? "fermi" : "krillion"}`, { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) { setMsg({ kind: "err", text: j.error ?? "Couldn't read that screenshot." }); return; }
      setPath(j.storagePath ?? undefined);
      if (game === "fermi") {
        const x = j.extraction as FermiExtraction; setFermiX(x);
        const d = x.gameDate ?? (x.puzzleNumber ? fermiDateForNumber(x.puzzleNumber) : null);
        setDateConfirmed(!!x.gameDate); if (d && d <= today) setDate(d);
      } else {
        setExtraction(j.extraction);
        setDateConfirmed(!!j.extraction.gameDate); if (j.extraction.gameDate) setDate(j.extraction.gameDate);
      }
    } catch { setMsg({ kind: "err", text: "Upload failed. Check your connection and try again." }); }
    finally { setBusy(false); }
  }

  const patchAnswer = (n: number, patch: Partial<KrillionExtraction["answers"][number]>) =>
    setExtraction((x) => x && { ...x, answers: x.answers.map((a) => (a.questionNumber === n ? { ...a, ...patch, uncertain: false } : a)) });

  const submit = () => start(async () => {
    setMsg(null);
    if (game === "krillion" && mode === "screenshot" && extraction) {
      return done(await saveResult({ game, gameDate: date, method: "screenshot", extraction, screenshotPath: path }));
    }
    if (game === "krillion") {
      const score = manualScore ? Number(manualScore) : kShare?.totalScore ?? undefined;
      return done(await saveResult({ game, gameDate: date, method: text ? "share_text" : "manual", rawText: text || undefined, score }));
    }
    if (game === "fermi" && mode === "screenshot" && fermiX) {
      return done(await saveResult({ game, gameDate: date, method: "screenshot", fermiExtraction: fermiX, screenshotPath: path }));
    }
    if (game === "fermi") {
      const typed = manualScore ? Number.parseFloat(manualScore) : fShare?.overall?.value;
      return done(await saveResult({ game, gameDate: date, method: text && !manualScore ? "share_text" : "manual", rawText: text || undefined, score: typed }));
    }
    return done(await saveResult({ game, gameDate: date, method: text ? "share_text" : "manual", rawText: text || undefined, score: manualScore ? Number(manualScore) : undefined }));
  });

  const sev = (n: number) => issues.find((i) => i.questionNumber === n)?.severity;
  const blocked = mode === "screenshot" && game === "krillion" && extraction ? hasBlockingIssues(issues) || !dateConfirmed : mode === "screenshot" && game === "fermi" && fermiX ? fermiX.score == null || !dateConfirmed : false;

  return (
    <div className="grid gap-3">
      <div className="chips" role="tablist" aria-label="Game">
        {(Object.keys(label) as GameKey[]).map((g) => (
          <button key={g} role="tab" aria-selected={g === game} className={`chip ${g === game ? "active" : ""}`} onClick={() => { setGame(g); setMode("text"); reset(); setMsg(null); }}>{label[g]}</button>
        ))}
      </div>

      <section className={`card ${game === "krillion" ? "bg-coral" : game === "fermi" ? "bg-butter" : "bg-lavender"}`} style={{ display: "grid", gap: 14 }}>
        <div>
          <span className="label">Add a result</span>
          <h2 className="serif" style={{ fontSize: 36, lineHeight: 1, marginTop: 6 }}>{game === "mystery" ? mysteryName ?? "Mystery game" : label[game]}</h2>
        </div>

        <label className="field"><span>Which day’s game?</span>
          <input type="date" value={date} max={today} onChange={(e) => { setDate(e.target.value); setDateConfirmed(true); }} /></label>

        {(game === "krillion" || game === "fermi") && (
          <div className="chips" style={{ margin: 0, padding: 0 }}>
            <button className={`chip ${mode === "text" ? "active" : ""}`} onClick={() => setMode("text")}>{game === "krillion" ? "Quick score" : "Paste text"}</button>
            <button className={`chip ${mode === "screenshot" ? "active" : ""}`} onClick={() => setMode("screenshot")}>{game === "krillion" ? "Full answers" : "Share card"}</button>
          </div>
        )}

        {mode === "text" && (<>
          <label className="field"><span>Paste the shared result</span>
            <textarea value={text} onChange={(e) => onText(e.target.value)} placeholder="Paste your result text here" /></label>
          {game === "krillion" && text && (
            <p className="tag" style={{ height: "auto", padding: "8px 12px", borderRadius: 14 }}>
              {kShare?.totalScore != null ? `Read a score of ${kShare.totalScore} / 700. Check it below.` : "Couldn’t find a score in that text. Enter it below."}
            </p>)}
          {game === "fermi" && fShare && (
            <div className="tag" style={{ height: "auto", padding: "10px 14px", borderRadius: 16, display: "grid", gap: 4 }}>
              {fShare.recognized ? (<>
                <b>Fermi No. {fShare.puzzleNumber} · {fShare.overall?.display}{fShare.topPercent != null ? ` · top ${fShare.topPercent}%` : ""}</b>
                <span>{fShare.questions.map((q) => q.display).join("  ·  ")}</span>
                <span style={{ opacity: .7 }}>Lower is better. Date set to {prettyShort(date)}; change it above if that’s wrong.</span>
                {fShare.warnings.map((w) => <span key={w} role="alert" style={{ color: "#7a1d14" }}>{w}</span>)}
              </>) : <span>That doesn’t look like a Fermi share. Enter your multiplier below, or use “Share card”.</span>}
            </div>)}
          <label className="field"><span>{game === "krillion" ? "Total score (0–700)" : game === "fermi" ? "Error multiplier (lower is better)" : "Score (optional)"}</span>
            <input inputMode="decimal" value={manualScore || (game === "krillion" && kShare?.totalScore != null ? String(kShare.totalScore) : game === "fermi" && fShare?.recognized && fShare.overall ? String(fShare.overall.value) : "")} onChange={(e) => setManualScore(e.target.value)} />
          </label>
          {game === "mystery" && <p className="muted" style={{ color: "var(--charcoal)", opacity: .7 }}>Without parsed proof this counts as marked complete, not a verified score.</p>}
        </>)}

        {mode === "screenshot" && (game === "krillion" || game === "fermi") && (<>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()} disabled={busy}>{busy ? "Reading your screenshot…" : preview ? "Choose a different screenshot" : game === "fermi" ? "Upload share card" : "Upload results screenshot"}</button>
          {preview && /* eslint-disable-next-line @next/next/no-img-element */ <img src={preview} alt="Your uploaded screenshot" style={{ maxHeight: 220, borderRadius: 18, objectFit: "cover", objectPosition: "top" }} />}
          {fermiX && (
            <div style={{ display: "grid", gap: 10 }}>
              <div className="flex items-baseline justify-between"><span className="label">Fermi{fermiX.puzzleNumber ? ` No. ${fermiX.puzzleNumber}` : ""}{fermiX.topPercent != null ? ` · top ${fermiX.topPercent}%` : ""}</span>
                <input aria-label="Score" className="serif" style={{ fontSize: 44, width: 150, textAlign: "right", background: "transparent", border: 0 }} inputMode="decimal"
                  value={fermiX.score ?? ""} onChange={(e) => setFermiX({ ...fermiX, score: e.target.value === "" ? null : Number(e.target.value) })} /></div>
              {fermiX.questions.map((q) => (
                <div key={q.questionNumber} style={{ background: "rgb(255 255 255 / .55)", borderRadius: 18, padding: 12 }}>
                  <div className="flex gap-3 items-baseline"><span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{q.questionNumber}. {q.questionText ?? "Question"}</span><b>{q.lessThan ? "< " : ""}{q.multiplier}×</b></div>
                </div>))}
              {checkFermi(fermiX).map((w) => <p key={w} role="status" style={{ fontSize: 13, fontWeight: 700, color: "#6b4a00" }}>Check: {w}</p>)}
              {!fermiX.gameDate && !dateConfirmed && <label className="flex items-center gap-2" style={{ fontWeight: 600, fontSize: 14 }}><input type="checkbox" onChange={(e) => setDateConfirmed(e.target.checked)} /> Yes, this was the game for {date}</label>}
            </div>)}
          {extraction && (
            <div style={{ display: "grid", gap: 10 }}>
              <div className="flex items-baseline justify-between"><span className="label">Total</span>
                <input aria-label="Total score" className="serif" style={{ fontSize: 44, width: 120, textAlign: "right", background: "transparent", border: 0 }} inputMode="numeric"
                  value={extraction.totalScore ?? ""} onChange={(e) => setExtraction({ ...extraction, totalScore: e.target.value === "" ? null : Number(e.target.value) })} /></div>
              {extraction.answers.map((a) => (
                <div key={a.questionNumber} style={{ background: "rgb(255 255 255 / .55)", borderRadius: 18, padding: 12, outline: sev(a.questionNumber) ? `2px solid ${sev(a.questionNumber) === "error" ? "#a02a1f" : "#b7791f"}` : "none" }}>
                  <div className="label">Q{a.questionNumber} · {a.questionText}</div>
                  <div className="flex gap-2" style={{ marginTop: 8 }}>
                    <input aria-label={`Answer ${a.questionNumber}`} style={{ flex: 1, height: 42, borderRadius: 12, border: 0, padding: "0 12px", font: "inherit", fontWeight: 600 }} value={a.answerText} onChange={(e) => patchAnswer(a.questionNumber, { answerText: e.target.value })} />
                    <input aria-label={`Points ${a.questionNumber}`} inputMode="numeric" style={{ width: 64, height: 42, borderRadius: 12, border: 0, textAlign: "center", font: "inherit", fontWeight: 800 }} value={a.points} onChange={(e) => patchAnswer(a.questionNumber, { points: Number(e.target.value) || 0 })} />
                  </div>
                </div>
              ))}
              {issues.map((i, n) => <p key={n} role={i.severity === "error" ? "alert" : "status"} style={{ fontSize: 13, fontWeight: 700, color: i.severity === "error" ? "#7a1d14" : "#6b4a00" }}>{i.severity === "error" ? "Needs fixing: " : "Check: "}{i.message}</p>)}
              {!extraction.gameDate && !dateConfirmed && (
                <label className="flex items-center gap-2" style={{ fontWeight: 600, fontSize: 14 }}><input type="checkbox" onChange={(e) => setDateConfirmed(e.target.checked)} /> Yes, this was the game for {date}</label>)}
            </div>)}
        </>)}

        {msg && <p role={msg.kind === "err" ? "alert" : "status"} style={{ fontWeight: 700, fontSize: 14 }}>{msg.text}</p>}
        <button className="btn" onClick={submit} disabled={pending || blocked || (mode === "screenshot" && !(game === "fermi" ? fermiX : extraction))} style={{ height: 52 }}>{pending ? "Saving…" : "Confirm and save"}</button>
      </section>
    </div>
  );
}
