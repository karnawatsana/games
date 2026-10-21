import { notFound } from "next/navigation";
import HomeView from "@/components/Home";
import { productDate } from "@/lib/dates";
import type { DailyState } from "@/lib/types";

// DEV-ONLY visual fixture for design review. Placeholder people and a placeholder game; not real data.
export default async function Preview({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_PREVIEW !== "1") notFound();
  const { done = "1" } = await searchParams;
  const n = Number(done);
  const state: DailyState = {
    date: productDate(),
    user: { name: "Sana", streak: 12 },
    krillion: n >= 1 ? { completed: true, scoreLabel: "310", scoreSuffix: "/ 700", verification: "verified" } : { completed: false },
    fermi: n >= 2 ? { completed: true, scoreLabel: "2.4×", scoreSuffix: "error", verification: "verified" } : { completed: false },
    mystery: {
      available: true,
      game: n >= 3 ? { id: "demo", name: "Sample Game", url: "https://example.com", description: "Placeholder description for design review.", category: "Geography", estimatedMinutes: 4 } : null,
      revealed: n >= 3,
      result: n >= 3 ? { completed: true, verification: "user_confirmed" } : { completed: false },
    },
    groups: [{ id: "g1", name: "Sample group", members: [
      { id: "1", name: "Sana", completed: n }, { id: "2", name: "Maya", completed: 3 },
      { id: "3", name: "Theo", completed: 2 }, { id: "4", name: "Jo", completed: 0 } ] }],
  };
  return <HomeView state={state} />;
}
