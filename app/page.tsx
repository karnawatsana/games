import HomeView from "@/components/Home";
import { getDailyState } from "@/lib/daily";

export const dynamic = "force-dynamic";

export default async function Page() {
  return <HomeView state={await getDailyState()} />;
}
