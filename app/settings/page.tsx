import AppShell from "@/components/AppShell";
import SettingsForms from "./SettingsForms";
import { avatarUrl, getViewer } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Settings() {
  const v = (await getViewer())!;
  return (
    <AppShell title={<>Your <em className="serif" style={{ color: "var(--lime)", fontWeight: 400 }}>settings.</em></>} eyebrow="Settings">
      <SettingsForms profile={{ display_name: v.profile.display_name, username: v.profile.username, share_answers: v.profile.share_answers, avatarUrl: avatarUrl(v.profile.avatar_path) }} />
    </AppShell>
  );
}
