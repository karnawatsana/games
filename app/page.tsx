import HomeView from "@/components/Home";
import { revealMystery } from "@/app/actions/mystery";
import { getDailyState } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Page() {
  return <HomeView state={await getDailyState()} onReveal={revealMystery} />;
}
