/**
 * Fermi (https://fermi.gg/) scores by error multiplier; LOWER is better.
 *
 * The real share-text format hasn't been verified (site unreachable from the build environment and
 * no sample supplied), so this parser makes NO claim of format support: it captures the raw text
 * and any multiplier-looking tokens ("2.4x", "×3") for the user to confirm. It never infers actual
 * estimates or invents per-question numbers.
 */
export type FermiParse = { raw: string; multipliers: string[]; overall: string | null; recognized: false; direction: "lower_is_better" };

export function parseFermiShare(text: string): FermiParse {
  const multipliers = [...text.matchAll(/(?:^|[^\w.])(\d+(?:\.\d+)?)\s*[x×]\b|[x×]\s*(\d+(?:\.\d+)?)/gi)].map((m) => m[1] ?? m[2]);
  return { raw: text, multipliers, overall: multipliers.length === 1 ? multipliers[0] : null, recognized: false, direction: "lower_is_better" };
}
