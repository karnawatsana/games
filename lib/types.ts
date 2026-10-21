export type GameSlug = "krillion" | "fermi" | "mystery";
export type Verification = "verified" | "user_confirmed" | "unverified";

export type GameResultSummary = {
  completed: boolean;
  scoreLabel?: string; // native representation, e.g. "310" or "3.2×"
  scoreSuffix?: string; // e.g. "/ 700"
  verification?: Verification;
};

export type MysteryGame = {
  id: string;
  name: string;
  url: string;
  description: string;
  category: string;
  estimatedMinutes: number;
};

export type Friend = { id: string; name: string; avatarUrl?: string; completed: number };

export type DailyState = {
  date: string;
  user: { name: string; avatarUrl?: string; streak: number } | null;
  krillion: GameResultSummary;
  fermi: GameResultSummary;
  mystery: { game: MysteryGame | null; revealed: boolean; result: GameResultSummary };
  groups: { id: string; name: string; members: Friend[] }[];
};
