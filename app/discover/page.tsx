import AppShell from "@/components/AppShell";
import ReactionButtons from "@/components/ReactionButtons";
import { getViewer } from "@/lib/data";
import { prettyDate, productDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const colors = ["lavender", "mint", "butter", "sky", "coral", "lime"];

export default async function Discover() {
  const viewer = (await getViewer())!;
  const today = productDate();
  const sb = await createClient();
  const [{ data: played }, { data: schedule }, { data: totals }, { data: mine }] = await Promise.all([
    sb.from("game_results").select("game_id, game_date, games!inner(name, slug, is_permanent, official_url, category)").eq("user_id", viewer.id).eq("games.is_permanent", false).order("game_date"),
    sb.from("daily_game_schedule").select("game_date, games(id, name, category, official_url)").lte("game_date", today).order("game_date", { ascending: false }).limit(30),
    sb.from("mystery_reaction_totals").select("game_id, reaction, n"),
    sb.from("mystery_game_reactions").select("game_date, reaction").eq("user_id", viewer.id),
  ]);

  type Pass = { name: string; url: string; category: string; first: string; times: number };
  const passport = new Map<string, Pass>();
  for (const r of played ?? []) {
    const g = r.games as unknown as { name: string; official_url: string; category: string };
    const p = passport.get(r.game_id);
    if (p) p.times++; else passport.set(r.game_id, { name: g.name, url: g.official_url, category: g.category, first: r.game_date, times: 1 });
  }
  const todayRow = schedule?.find((s) => s.game_date === today);
  const todayDone = todayRow && (played ?? []).some((p) => p.game_date === today);

  return (
    <AppShell title={<>Your <em className="serif" style={{ color: "var(--lime)", fontWeight: 400 }}>passport.</em></>} eyebrow={`Discover · ${passport.size} ${passport.size === 1 ? "game" : "games"} tried`}>
      {todayDone && (
        <section className="card bg-lavender" style={{ display: "grid", gap: 12 }}>
          <h2 className="serif" style={{ fontSize: 32 }}>How was today’s game?</h2>
          <ReactionButtons date={today} current={mine?.find((m) => m.game_date === today)?.reaction} />
        </section>)}
      {passport.size === 0 ? <div className="friends"><h2 className="serif" style={{ fontSize: 32 }}>Your stamps will land here.</h2><p className="muted" style={{ marginTop: 8 }}>Finish a mystery game and it joins your collection.</p></div> :
        <div className="pair">{[...passport.values()].map((p, i) => (
          <a key={p.name} href={p.url} target="_blank" rel="noopener noreferrer" className={`card bg-${colors[i % colors.length]}`} style={{ minHeight: 170, display: "grid", alignContent: "space-between" }}>
            <span className="label">{p.category}</span>
            <div><h3 className="serif" style={{ fontSize: 30, lineHeight: 1 }}>{p.name}</h3>
              <p style={{ fontSize: 12, fontWeight: 600, opacity: .7, marginTop: 6 }}>First played {prettyDate(p.first)} · {p.times}×</p></div>
          </a>))}</div>}

      <section className="friends"><div className="board-title"><h2 className="serif">Past mystery games</h2></div>
        {!schedule?.length ? <div className="empty">No mystery games have run yet.</div> : schedule.map((s) => {
          const g = s.games as unknown as { id: string; name: string } | null;
          const t = (totals ?? []).filter((x) => x.game_id === g?.id);
          const n = (k: string) => t.find((x) => x.reaction === k)?.n ?? 0;
          return (
            <div className="row" key={s.game_date} style={{ gridTemplateColumns: "1fr auto" }}>
              <span className="who"><b>{g?.name}</b><span>{prettyDate(s.game_date)}</span></span>
              <span className="muted">{n("loved") + n("okay") + n("not_for_me") > 0 ? `${n("loved")} loved · ${n("okay")} okay · ${n("not_for_me")} not for me` : ""}</span>
            </div>); })}
      </section>
    </AppShell>
  );
}
