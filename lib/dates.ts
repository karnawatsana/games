export const PRODUCT_TZ = process.env.NEXT_PUBLIC_PRODUCT_TIMEZONE || "America/New_York";

/** Calendar date (YYYY-MM-DD) in the product timezone. DST-safe via Intl. */
export function productDate(at: Date = new Date(), tz: string = PRODUCT_TZ): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(at);
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return `${g("year")}-${g("month")}-${g("day")}`;
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Monday-start ISO week bounds containing `date`. */
export function weekBounds(date: string): { start: string; end: string } {
  const dow = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7; // Mon=0
  const start = addDays(date, -dow);
  return { start, end: addDays(start, 6) };
}

export function prettyDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" }).format(new Date(`${date}T12:00:00Z`));
}
