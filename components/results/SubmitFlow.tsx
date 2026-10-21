"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { saveResult, type SaveResult } from "@/app/actions/results";
import { parseKrillionShare } from "@/lib/krillion/shareText";
import { parseFermiShare } from "@/lib/fermi/parse";
import { hasBlockingIssues, validateExtraction, type Issue } from "@/lib/krillion/validate";
import type { KrillionExtraction } from "@/lib/krillion/schema";

type GameKey = "krillion" | "fermi" | "mystery";
type Props = { today: string; username: string; mysteryName: string | null; initialGame?: GameKey };

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
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const issues: Issue[] = useMemo(() => (extraction ? validateExtraction(extraction, { username }).issues : []), [extraction, username]);
  const kShare = useMemo(() => (game === "krillion" && text ? parseKrillionShare(text) : null), [game, text]);
  const fShare = useMemo(() => (game === "fermi" && text ? parseFermiShare(text) : null), [game, text]);

  const reset = () => { setExtraction(null); setPreview(null); setPath(undefined); setText(""); setManualScore(""); };
  const done = (r: SaveResult) => { if (r.ok) { setMsg({ kind: "ok", text: statusCopy[r.status] }); reset(); } else setMsg({ kind: "err", text: r.error }); };

  async function onFile(f: File | undefined) {
    if (!f) return;
    setMsg(null); setExtraction(null); setPreview(URL.createObjectURL(f)); setBusy(true);
    const fd = new FormData(); fd.set("image", f);
    try {
      const res = await fetch("/api/extract/krillion", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) { setMsg({ kind: "err", text: j.error ?? "Couldn't read that screenshot." }); return; }
      setExtraction(j.extraction); setPath(j.storagePath ?? undefined);
      setDateConfirmed(!!j.extraction.gameDate); if (j.extraction.gameDate) setDate(j.extraction.gameDate);
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
    if (game === "fermi") {
      const display = manualScore || fShare?.overall || undefined;
      return done(await saveResult({ game, gameDate: date, method: text && !manualScore ? "share_text" : "manual", rawText: text || undefined, scoreDisplay: display, score: display ? Number.parseFloat(display) : undefined }));
    }
    return done(await saveResult({ game, gameDate: date, method: text ? "share_text" : "manual", rawText: text || undefined, score: manualScore ? Number(manualScore) : undefined }));
  });

  const sev = (n: number) => issues.find((i) => i.questionNumber === n)?.severity;
  const blocked = mode === "screenshot" && extraction ? hasBlockingIssues(issues) || !dateConfirmed : false;

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

        {game === "krillion" && (
          <div className="chips" style={{ margin: 0, padding: 0 }}>
            <button className={`chip ${mode === "text" ? "active" : ""}`} onClick={() => setMode("text")}>Quick score</button>
            <button className={`chip ${mode === "screenshot" ? "active" : ""}`} onClick={() => setMode("screenshot")}>Full answers</button>
          </div>
        )}

        {mode === "text" && (<>
          <label className="field"><span>Paste the shared result</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste your result text here" /></label>
          {game === "krillion" && text && (
            <p className="tag" style={{ height: "auto", padding: "8px 12px", borderRadius: 14 }}>
              {kShare?.totalScore != null ? `Read a score of ${kShare.totalScore} / 700. Check it below.` : "Couldn’t find a score in that text. Enter it below."}
            </p>)}
          {game === "fermi" && text && (
            <p className="tag" style={{ height: "auto", padding: "8px 12px", borderRadius: 14 }}>
              {fShare?.overall ? `Found ${fShare.overall}×. Lower is better. Please confirm.` : "We don’t read Fermi share text automatically yet. Enter your multiplier below."}
            </p>)}
          <label className="field"><span>{game === "krillion" ? "Total score (0–700)" : game === "fermi" ? "Error multiplier (lower is better)" : "Score (optional)"}</span>
            <input inputMode="decimal" value={manualScore || (game === "krillion" && kShare?.totalScore != null ? String(kShare.totalScore) : game === "fermi" && fShare?.overall ? fShare.overall : "")} onChange={(e) => setManualScore(e.target.value)} />
          </label>
          {game === "mystery" && <p className="muted" style={{ color: "var(--charcoal)", opacity: .7 }}>Without parsed proof this counts as marked complete, not a verified score.</p>}
        </>)}

        {mode === "screenshot" && game === "krillion" && (<>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()} disabled={busy}>{busy ? "Reading your screenshot…" : preview ? "Choose a different screenshot" : "Upload results screenshot"}</button>
          {preview && /* eslint-disable-next-line @next/next/no-img-element */ <img src={preview} alt="Your uploaded screenshot" style={{ maxHeight: 220, borderRadius: 18, objectFit: "cover", objectPosition: "top" }} />}
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
        <button className="btn" onClick={submit} disabled={pending || blocked || (mode === "screenshot" && !extraction)} style={{ height: 52 }}>{pending ? "Saving…" : "Confirm and save"}</button>
      </section>
    </div>
  );
}
