import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import CompareView from "@/components/results/CompareView";
import { KRILLION_FIXTURE as _ } from "@/tests/fixtures/krillion-expected";

// DEV-ONLY visual fixture (placeholder people, not real data).
export default async function P({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { view } = await searchParams;
  const people = [{ id: "a", name: "Sana" }, { id: "b", name: "Maya" }, { id: "c", name: "Theo" }];
  const q = (n: number, t: string) => t;
  const texts = ["NAME A TV SHOW THAT'S RATED 8.5+ ON IMDB", "NAME A CURRENT NBA PLAYER", "NAME A FOOD YOU HAVE TO SHELL OR CRACK OPEN BEFORE EATING"];
  const rows = _.answers.slice(0, 3).flatMap((a, i) => [
    { userId: "a", questionNumber: a.questionNumber, questionText: q(i, texts[i]), answerText: a.answerText, points: a.points, rarity: null },
    { userId: "b", questionNumber: a.questionNumber, questionText: texts[i], answerText: i === 0 ? "Severance" : ["Giannis", "Walnut"][i - 1], points: [30, 10, 30][i], rarity: null },
    { userId: "c", questionNumber: a.questionNumber, questionText: texts[i], answerText: ["The Wire", "Luka Doncic", "Pistachio"][i], points: [60, 30, 10][i], rarity: null },
  ]);
  return <AppShell title={<>Compare <em className="serif" style={{ color: "var(--lime)", fontWeight: 400 }}>answers.</em></>} eyebrow="Sample group"><CompareView rows={rows} people={people} view={view === "player" ? "player" : "question"} baseHref="/preview/compare" /></AppShell>;
}
