import { redirect } from "next/navigation";
import { joinGroup } from "@/app/actions/groups";
import { getViewer } from "@/lib/data";
import AppShell from "@/components/AppShell";

export default async function Join({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!(await getViewer())) redirect(`/login?next=${encodeURIComponent(`/join/${token}`)}`);
  async function accept() { "use server"; const r = await joinGroup(token); if (r?.error) redirect(`/groups?invite=invalid`); }
  return (
    <AppShell title={<>You’re <em className="serif" style={{ color: "var(--lime)", fontWeight: 400 }}>invited.</em></>} eyebrow="Join a group">
      <form action={accept} className="card bg-mint" style={{ display: "grid", gap: 12 }}>
        <p style={{ fontWeight: 500 }}>Joining shares your results from today onward with the group. Anything you played earlier stays private.</p>
        <button className="btn" style={{ height: 52 }}>Join group</button>
      </form>
    </AppShell>
  );
}
