import Link from "next/link";
import AppShell from "@/components/AppShell";
import { createGroup } from "@/app/actions/groups";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/auth";
import CreateGroupForm from "./CreateGroupForm";

export const dynamic = "force-dynamic";
const colors = ["coral", "butter", "mint", "sky", "lavender", "lime"];

export default async function Groups() {
  await requireViewer("/groups");
  const sb = await createClient();
  const { data } = await sb.from("group_members").select("group_id, groups(id, name)");
  const groups = (data ?? []).map((d) => d.groups as unknown as { id: string; name: string }).filter(Boolean);
  return (
    <AppShell title={<>Your <em className="serif" style={{ color: "var(--lime)", fontWeight: 400 }}>groups.</em></>} eyebrow="Groups">
      {groups.length === 0 && <div className="friends"><h2 className="serif" style={{ fontSize: 32 }}>No groups yet.</h2><p className="muted" style={{ marginTop: 8 }}>Start one for your friends, or open an invite link someone sent you.</p></div>}
      {groups.map((g, i) => (
        <Link key={g.id} href={`/groups/${g.id}`} className={`card bg-${colors[i % colors.length]}`} style={{ display: "block" }}>
          <span className="label">Group</span>
          <h2 className="serif" style={{ fontSize: 40, lineHeight: 1, marginTop: 6 }}>{g.name}</h2>
        </Link>
      ))}
      <CreateGroupForm action={createGroup} />
    </AppShell>
  );
}
