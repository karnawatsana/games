import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import Avatar from "@/components/Avatar";
import InviteButton from "@/components/InviteButton";
import { loadGroup } from "@/lib/groupData";
import { getViewer } from "@/lib/data";
import { productDate } from "@/lib/dates";
import { dailyBoard, rankGameScores, weeklyBoard } from "@/lib/stats";
import { createClient } from "@/lib/supabase/server";
import { leaveGroup } from "@/app/actions/groups";

export const dynamic = "force-dynamic";
const EVENT: Record<string, (n: string, g?: string) => string> = {
  completed_game: (n, g) => `${n} finished ${g ?? "a game"}.`,
  completed_daily_three: (n) => `${n} completed today’s three.`,
  discovered_game: (n, g) => `${n} discovered ${g ?? "a new game"}.`,
  personal_best: (n, g) => `${n} set a personal best${g ? ` on ${g}` : ""}.`,
  joined_group: (n) => `${n} joined the group.`,
};

export default async function GroupPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params; const { tab = "daily" } = await searchParams;
  const viewer = (await getViewer())!;
  const today = productDate();
  const data = await loadGroup(id, today);
  if (!data) notFound();
  const { group, members, results } = data;
  const byId = new Map(members.map((m) => [m.id, m]));
  const ids = members.map((m) => m.id);
  const isOwner = group.owner_id === viewer.id;

  const sb = await createClient();
  const { data: feed } = await sb.from("group_activity").select("id, user_id, event_type, created_at, games(name)").eq("group_id", id).order("created_at", { ascending: false }).limit(8);

  const daily = dailyBoard(results, ids, today);
  const weekly = weeklyBoard(results, ids, today);
  const games = ["krillion", "fermi", "mystery"] as const;

  return (
    <AppShell title={group.name} eyebrow={`${members.length} ${members.length === 1 ? "member" : "members"}`}>
      <div className="chips" role="tablist">
        {[["daily", "Today"], ["weekly", "This week"], ["games", "By game"]].map(([k, l]) => <Link key={k} role="tab" aria-selected={tab === k} href={`?tab=${k}`} className={`chip ${tab === k ? "active" : ""}`} style={{ display: "grid", placeItems: "center" }}>{l}</Link>)}
      </div>

      {members.length === 1 && <div className="empty">Waiting on friends. Share the invite link below to get started.</div>}

      <section className="friends">
        {tab === "daily" && (<>
          <div className="board-title"><h2 className="serif">Daily <em>three</em></h2></div>
          {daily.map((e) => { const m = byId.get(e.userId)!; return (
            <div className={`row ${e.userId === viewer.id ? "you" : ""}`} key={e.userId} style={{ gridTemplateColumns: "28px 40px 1fr auto" }}>
              <span className="rank">{e.rank}{e.tied ? "=" : ""}</span><Avatar name={m.name} url={m.avatarUrl} id={m.id} />
              <span className="who"><b>{m.name}</b>
                <span style={{ display: "flex", gap: 4, marginTop: 6 }}>{[0, 1, 2].map((i) => <i key={i} className={`seg ${i < e.completed ? "on" : ""}`} style={{ width: 28, height: 6 }} />)}</span></span>
              <span className="pts">{e.completed}<span className="muted">/3</span></span>
            </div>); })}
          {daily.some((e) => e.tied) && <p className="muted" style={{ marginTop: 10 }}>“=” means a tie. Equal completions share a rank.</p>}
        </>)}
        {tab === "weekly" && (<>
          <div className="board-title"><h2 className="serif">Consistency</h2></div>
          {weekly.map((e) => { const m = byId.get(e.userId)!; return (
            <div className={`row ${e.userId === viewer.id ? "you" : ""}`} key={e.userId} style={{ gridTemplateColumns: "28px 40px 1fr auto" }}>
              <span className="rank">{e.rank}{e.tied ? "=" : ""}</span><Avatar name={m.name} url={m.avatarUrl} id={m.id} />
              <span className="who"><b>{m.name}</b><span>{e.allThreeDays} full {e.allThreeDays === 1 ? "day" : "days"} · {e.streak}-day streak</span></span>
              <span className="pts">{e.gamesCompleted}</span>
            </div>); })}
        </>)}
        {tab === "games" && games.map((g) => {
          const todays = results.filter((r) => r.game_slug === g && r.game_date === today);
          const dir = todays[0]?.game.score_direction ?? (g === "krillion" ? "higher_better" : g === "fermi" ? "lower_better" : "none");
          const ranked = rankGameScores(todays.map((r) => ({ userId: r.user_id, score: r.score_numeric ?? null, display: r.display, max: r.game.max_score })), dir);
          return (
            <div key={g} style={{ marginBottom: 18 }}>
              <div className="board-title"><h2 className="serif" style={{ textTransform: "capitalize" }}>{g}</h2><span className="muted">{dir === "higher_better" ? "Higher is better" : dir === "lower_better" ? "Lower is better" : "Completions"}</span></div>
              {todays.length === 0 && <div className="empty">No one has submitted yet today.</div>}
              {(ranked ?? todays.map((r) => ({ userId: r.user_id, score: null as number | null, display: undefined as string | undefined, max: null as number | null, rank: null as number | null }))).map((e) => { const m = byId.get(e.userId)!; return (
                <div className="row" key={e.userId} style={{ gridTemplateColumns: "28px 40px 1fr auto" }}>
                  <span className="rank">{e.rank ?? "·"}</span><Avatar name={m.name} url={m.avatarUrl} id={m.id} /><span className="who"><b>{m.name}</b></span>
                  <span className="pts">{e.display ?? (e.score != null ? `${e.score}${e.max ? `/${e.max}` : ""}` : "Done")}</span>
                </div>); })}
            </div>);
        })}
      </section>

      <Link href={`/results/compare?group=${id}`} className="card bg-sky" style={{ display: "block" }}><span className="label">Krillion</span><h2 className="serif" style={{ fontSize: 34, marginTop: 6 }}>Compare answers →</h2></Link>

      <section className="friends"><div className="board-title"><h2 className="serif">Activity</h2></div>
        {!feed?.length ? <div className="empty">Quiet so far.</div> : feed.map((f) => (
          <p key={f.id} style={{ padding: "8px 4px", fontSize: 14 }}>{EVENT[f.event_type]?.(byId.get(f.user_id)?.name ?? "Someone", (f.games as unknown as { name: string } | null)?.name)}</p>))}
      </section>

      {isOwner && <section className="card bg-mint"><h2 className="serif" style={{ fontSize: 32, marginBottom: 10 }}>Invite friends</h2><InviteButton groupId={id} /></section>}
      {!isOwner && <form action={leaveGroup.bind(null, id)}><button className="btn btn-ghost" style={{ background: "var(--charcoal-2)", color: "var(--cream)" }}>Leave group</button></form>}
    </AppShell>
  );
}
