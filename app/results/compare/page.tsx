import Link from "next/link";
import AppShell from "@/components/AppShell";
import CompareView from "@/components/results/CompareView";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { avatarUrl, getViewer } from "@/lib/data";
import { prettyDate, productDate } from "@/lib/dates";
import type { AnswerRow } from "@/lib/compare";

export const dynamic = "force-dynamic";

export default async function Compare({ searchParams }: { searchParams: Promise<{ group?: string; date?: string; view?: string; reveal?: string }> }) {
  const sp = await searchParams;
  const viewer = (await getViewer())!;
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : productDate();
  const sb = await createClient();

  const { data: mem } = await sb.from("group_members").select("group_id, groups(id, name)").eq("user_id", viewer.id);
  const groups = (mem ?? []).map((m) => m.groups as unknown as { id: string; name: string });
  const group = groups.find((g) => g.id === sp.group) ?? groups[0];
  if (!group) return <AppShell title="Compare answers" eyebrow="Krillion"><div className="empty">Join a group to compare answers with friends.</div></AppShell>;

  const { data: k } = await sb.from("games").select("id").eq("slug", "krillion").single();
  const { data: members } = await sb.from("group_members").select("user_id, profiles(display_name, avatar_path, share_answers)").eq("group_id", group.id);
  const people = (members ?? []).map((m) => { const p = m.profiles as unknown as { display_name: string; avatar_path: string | null; share_answers: boolean }; return { id: m.user_id, name: p.display_name, avatarUrl: avatarUrl(p.avatar_path), share: p.share_answers }; });

  // Results RLS already limits to visible rows. Answers are RLS-gated on "viewer finished Krillion that day".
  const { data: results } = await sb.from("game_results").select("id, user_id").eq("game_id", k!.id).eq("game_date", date).in("user_id", people.map((p) => p.id));
  const mine = results?.find((r) => r.user_id === viewer.id);
  const others = (results ?? []).filter((r) => r.user_id !== viewer.id);

  let answers: AnswerRow[] = [];
  const fetchWith = async (client: typeof sb, ids: string[]) => {
    const { data } = await client.from("krillion_answers").select("game_result_id, question_number, question_text, answer_text, points, rarity_indicator").in("game_result_id", ids);
    return (data ?? []).map((a): AnswerRow => ({ userId: results!.find((r) => r.id === a.game_result_id)!.user_id, questionNumber: a.question_number, questionText: a.question_text, answerText: a.answer_text, points: a.points, rarity: a.rarity_indicator }));
  };
  const ids = (results ?? []).map((r) => r.id);
  const spoilerGate = !mine && others.length > 0;
  if (ids.length && !spoilerGate) answers = await fetchWith(sb, ids);
  else if (ids.length && sp.reveal === "1") {
    // Explicit spoiler reveal: already confirmed visible via RLS above (results are only returned for group members after join date). Respect each owner's privacy setting.
    const allowed = ids.filter((id) => { const uid = results!.find((r) => r.id === id)!.user_id; return people.find((p) => p.id === uid)?.share; });
    if (allowed.length) answers = await fetchWith(createAdminClient() as unknown as typeof sb, allowed);
  }

  const base = `/results/compare?group=${group.id}&date=${date}`;
  return (
    <AppShell title={<>Compare <em className="serif" style={{ color: "var(--lime)", fontWeight: 400 }}>answers.</em></>} eyebrow={`${group.name} · ${prettyDate(date)}`}>
      {groups.length > 1 && <div className="chips">{groups.map((g) => <Link key={g.id} className={`chip ${g.id === group.id ? "active" : ""}`} href={`/results/compare?group=${g.id}&date=${date}`}>{g.name}</Link>)}</div>}
      {spoilerGate && sp.reveal !== "1" && (
        <section className="card bg-lavender" style={{ display: "grid", gap: 12 }}>
          <h2 className="serif" style={{ fontSize: 36, lineHeight: 1 }}>Spoilers ahead.</h2>
          <p style={{ fontWeight: 500 }}>Your friends’ answers are hidden until you’ve played Krillion. Add your score and they unlock.</p>
          <div className="flex gap-2"><Link className="btn" style={{ flex: 1 }} href="/results?game=krillion">Add my result</Link>
            <Link className="btn btn-ghost" href={`${base}&reveal=1`}>Show anyway</Link></div>
          <p style={{ fontSize: 12, opacity: .7 }}>“Show anyway” reveals today’s answers before you’ve played.</p>
        </section>)}
      {!others.length && !mine && <div className="empty">No Krillion results for this day yet.</div>}
      {answers.length > 0 && <CompareView rows={answers} people={people} view={sp.view === "player" ? "player" : "question"} baseHref={base} />}
      {!spoilerGate && !answers.length && (results?.length ?? 0) > 0 && <div className="empty">Nobody has added their full answers for this day yet. Upload a screenshot under Results to share yours.</div>}
    </AppShell>
  );
}
