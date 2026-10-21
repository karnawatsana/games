import Link from "next/link";
import AppShell from "@/components/AppShell";
import SubmitFlow from "@/components/results/SubmitFlow";
import { getMysteryGameRow } from "@/lib/data";
import { requireViewer } from "@/lib/auth";
import { productDate, prettyDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Results({ searchParams }: { searchParams: Promise<{ game?: string }> }) {
  const { game } = await searchParams;
  const viewer = await requireViewer("/results");
  const today = productDate();
  const sb = await createClient();
  const [mystery, { data: history }] = await Promise.all([
    getMysteryGameRow(today).catch(() => null),
    sb.from("game_results").select("id, game_date, score_numeric, score_data, verification_status, games(name, slug, max_score)").eq("user_id", viewer.id).order("game_date", { ascending: false }).limit(30),
  ]);
  const initial = game === "fermi" || game === "mystery" ? game : "krillion";
  return (
    <AppShell title={<>Add a <em className="serif" style={{ color: "var(--lime)", fontWeight: 400 }}>result.</em></>} eyebrow="Results">
      <SubmitFlow today={today} username={viewer.profile.username} mysteryName={mystery?.name ?? null} initialGame={initial} />
      <Link href="/results/compare" className="card bg-sky" style={{ display: "block" }}>
        <span className="label">Krillion</span>
        <h2 className="serif" style={{ fontSize: 34, marginTop: 6 }}>Compare answers →</h2>
      </Link>
      <section className="friends" aria-label="History">
        <div className="board-title"><h2 className="serif">History</h2></div>
        {!history?.length ? <div className="empty">Nothing yet. Play a game, then add it above.</div> : history.map((h) => {
          const g = h.games as unknown as { name: string; slug: string; max_score: number | null };
          const shown = g.slug === "fermi" ? (h.score_data as { display?: string }).display : h.score_numeric != null ? `${h.score_numeric}${g.max_score ? ` / ${g.max_score}` : ""}` : "Completed";
          return (
            <div className="row" key={h.id} style={{ gridTemplateColumns: "1fr auto" }}>
              <span className="who"><b>{g.name}</b><span>{prettyDate(h.game_date)} · {h.verification_status === "verified" ? "Verified" : h.verification_status === "user_confirmed" ? "Marked complete" : "Unverified"}</span></span>
              <span className="pts">{shown}</span>
            </div>);
        })}
      </section>
    </AppShell>
  );
}
