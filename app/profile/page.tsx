import Link from "next/link";
import AppShell from "@/components/AppShell";
import Avatar from "@/components/Avatar";
import { avatarUrl, getViewer } from "@/lib/data";
import { productDate } from "@/lib/dates";
import { activeStreak, longestStreak, personalBest, completedOn, type ResultRow } from "@/lib/stats";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Profile() {
  const v = (await getViewer())!;
  const sb = await createClient();
  const today = productDate();
  const [{ data: res }, { data: mem }] = await Promise.all([
    sb.from("game_results").select("game_date, score_numeric, verification_status, games(slug, score_direction)").eq("user_id", v.id).order("game_date", { ascending: false }),
    sb.from("group_members").select("groups(id, name)").eq("user_id", v.id),
  ]);
  type G = { slug: string; score_direction: "higher_better" | "lower_better" | "none" };
  const rows: (ResultRow & { dir: G["score_direction"] })[] = (res ?? []).map((r) => { const g = r.games as unknown as G; return { user_id: v.id, game_slug: g.slug === "krillion" || g.slug === "fermi" ? g.slug : "mystery", game_date: r.game_date, verification: r.verification_status, score_numeric: r.score_numeric, dir: g.score_direction }; });
  const dates = [...new Set(rows.map((r) => r.game_date))];
  const threes = dates.filter((d) => completedOn(rows, v.id, d).length === 3);
  const best = (slug: string) => { const s = rows.filter((r) => r.game_slug === slug && r.score_numeric != null); return personalBest(s.map((r) => r.score_numeric!), s[0]?.dir ?? "none"); };
  const recent = Array.from({ length: 14 }, (_, i) => { const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - (13 - i)); const ds = d.toISOString().slice(0, 10); return { ds, n: completedOn(rows, v.id, ds).length }; });
  const stat = (label: string, value: string | number, c: string) => <div className={`card bg-${c}`} style={{ padding: 18 }}><span className="label">{label}</span><div style={{ fontSize: 52, fontWeight: 800, letterSpacing: "-0.05em", lineHeight: 1, marginTop: 8 }}>{value}</div></div>;
  const groups = (mem ?? []).map((m) => m.groups as unknown as { id: string; name: string });

  return (
    <AppShell title={v.profile.display_name} eyebrow={`@${v.profile.username}`}>
      <div className="flex items-center gap-3" style={{ padding: "0 4px" }}><Avatar name={v.profile.display_name} url={avatarUrl(v.profile.avatar_path)} size={56} /><Link href="/settings" className="btn btn-ghost" style={{ background: "var(--charcoal-2)", color: "var(--cream)" }}>Edit profile</Link></div>
      <div className="pair">{stat("Current streak", activeStreak(rows, v.id, today), "lime")}{stat("Longest", longestStreak(rows, v.id), "butter")}{stat("Games", rows.length, "mint")}{stat("Daily threes", threes.length, "coral")}</div>
      <section className="friends"><div className="board-title"><h2 className="serif">Last 14 days</h2></div>
        <div style={{ display: "flex", gap: 6 }} role="img" aria-label="Games completed per day for the last 14 days">
          {recent.map((d) => <div key={d.ds} title={`${d.ds}: ${d.n}/3`} style={{ flex: 1, height: 56, borderRadius: 10, background: d.n === 3 ? "var(--lime)" : d.n ? "var(--butter, #ffd16a)" : "var(--charcoal-3)", opacity: d.n === 0 ? 1 : .35 + d.n * .22 }} />)}
        </div>
        <p className="muted" style={{ marginTop: 10 }}>Lime days: all three played.</p>
      </section>
      <section className="friends"><div className="board-title"><h2 className="serif">Personal records</h2></div>
        <div className="row" style={{ gridTemplateColumns: "1fr auto" }}><span className="who"><b>Krillion</b><span>Highest score</span></span><span className="pts">{best("krillion") ?? "–"}</span></div>
        <div className="row" style={{ gridTemplateColumns: "1fr auto" }}><span className="who"><b>Fermi</b><span>Lowest multiplier</span></span><span className="pts">{best("fermi") ?? "–"}</span></div>
      </section>
      <section className="friends"><div className="board-title"><h2 className="serif">Groups</h2></div>
        {groups.length ? groups.map((g) => <Link key={g.id} href={`/groups/${g.id}`} className="row" style={{ gridTemplateColumns: "1fr" }}><b>{g.name}</b></Link>) : <div className="empty">Not in a group yet.</div>}
      </section>
    </AppShell>
  );
}
