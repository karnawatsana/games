/**
 * Fermi (https://fermi.gg/) share text. Scored by error multiplier: LOWER is better.
 * Format verified against a real share (No. 87):
 *
 *   Fermi · No. 87
 *   01  1.00×
 *   02  3.00×
 *   03  22.9×
 *   ─────────
 *   4.09× score · top 46%
 *   <https://fermi.gg/s/daily>
 *
 * The overall score is the geometric mean of the per-question multipliers. The share text carries no
 * date and no question text (the share card image does), so the puzzle number is the only identifier.
 */
export type FermiQuestion = { n: number; multiplier: number; display: string; bound?: "lt" };
export type FermiParse = {
  recognized: boolean;
  puzzleNumber: number | null;
  questions: FermiQuestion[];
  overall: { value: number; display: string } | null;
  topPercent: number | null;
  url: string | null;
  direction: "lower_is_better";
  warnings: string[];
};

// One known pairing from a real card: No. 87 was October 21st, 2026. Fermi is daily, so other numbers are
// derived by counting days; the UI always asks the user to confirm the date.
export const FERMI_ANCHOR = { number: 87, date: "2026-10-21" } as const;

export function fermiDateForNumber(n: number): string {
  const d = new Date(`${FERMI_ANCHOR.date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + (n - FERMI_ANCHOR.number));
  return d.toISOString().slice(0, 10);
}

const X = "[×xX]";

export function geometricMean(vals: number[]): number {
  return Math.exp(vals.reduce((s, v) => s + Math.log(v), 0) / vals.length);
}

export function parseFermiShare(text: string): FermiParse {
  const t = text.replace(/ /g, " ");
  const warnings: string[] = [];
  const head = t.match(/fermi\s*[·•\-–|]?\s*no\.?\s*0*(\d{1,5})/i);
  const questions: FermiQuestion[] = [...t.matchAll(new RegExp(`^\\s*0?(\\d{1,2})\\s+(<\\s*)?(\\d+(?:\\.\\d+)?)\\s*${X}`, "gm"))]
    .map((m) => ({ n: Number(m[1]), multiplier: Number(m[3]), display: `${m[3]}×`, ...(m[2] ? { bound: "lt" as const } : {}) }));
  const score = t.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${X}\\s*score(?:\\s*[·•\\-–|]\\s*top\\s*(\\d+(?:\\.\\d+)?)\\s*%)?`, "i"));
  const url = t.match(/https?:\/\/(?:www\.)?fermi\.gg\/[^\s>)]*/i)?.[0] ?? null;

  const overall = score ? { value: Number(score[1]), display: `${score[1]}×` } : null;
  const nums = questions.map((q) => q.n);
  if (new Set(nums).size !== nums.length) warnings.push("Some question numbers appear twice.");
  if (overall && overall.value < 1) warnings.push("A multiplier below 1× isn't possible.");
  if (overall && questions.length > 0) {
    const gm = geometricMean(questions.map((q) => q.multiplier));
    // per-question values are rounded to 3 significant figures, so allow ~1.5% slack
    if (Math.abs(gm - overall.value) / overall.value > 0.015) warnings.push(`The questions average ${gm.toFixed(2)}×, not ${overall.value}×. Please check.`);
  }
  return {
    recognized: !!(head && overall),
    puzzleNumber: head ? Number(head[1]) : null,
    questions, overall,
    topPercent: score?.[2] ? Number(score[2]) : null,
    url, direction: "lower_is_better", warnings,
  };
}
