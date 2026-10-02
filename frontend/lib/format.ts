const JAKARTA_TIME_ZONE = "Asia/Jakarta";

export function formatDateTimeJakarta(iso: string | null): string {
  if (!iso) return "never";
  return `${new Date(iso).toLocaleString("en-GB", { timeZone: JAKARTA_TIME_ZONE })} WIB`;
}

const INDO_MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

// Locale/timezone pinned explicitly throughout (same reason as
// formatDateTimeJakarta above) — Intl output otherwise depends on the
// runtime's default locale, which differs between the Node SSR pass and
// the browser, and produces a hydration mismatch.
function jakartaDateParts(d: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: JAKARTA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  return { year: get("year"), month: get("month"), day: get("day") };
}

function jakartaTimeHHmm(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: JAKARTA_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

// Whole-calendar-day difference in the Jakarta timezone (not a 24h-rounded
// diff) — "today" and "yesterday" should follow the Jakarta calendar date,
// not "less than 24h ago", so e.g. 23:50 and 00:10 WIB the next day count
// as different days even though only 20 minutes apart.
function jakartaDayDiff(from: Date, to: Date): number {
  const a = jakartaDateParts(from);
  const b = jakartaDateParts(to);
  const utcA = Date.UTC(a.year, a.month - 1, a.day);
  const utcB = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((utcB - utcA) / 86_400_000);
}

/**
 * < 7 days old: relative ("Hari ini, 08:02" / "Kemarin, 14:30" / "3 hari
 * lalu"). >= 7 days old (or a future timestamp — clock skew/bad data):
 * absolute date ("15 Jul 2026"). All bucketing and time-of-day extraction
 * use the Jakarta calendar day, same as formatDateTimeJakarta.
 */
export function formatRelativeDate(iso: string | null): string {
  if (!iso) return "never";
  const date = new Date(iso);
  const dayDiff = jakartaDayDiff(date, new Date());

  if (dayDiff === 0) return `Hari ini, ${jakartaTimeHHmm(date)}`;
  if (dayDiff === 1) return `Kemarin, ${jakartaTimeHHmm(date)}`;
  if (dayDiff > 1 && dayDiff < 7) return `${dayDiff} hari lalu`;

  const p = jakartaDateParts(date);
  return `${String(p.day).padStart(2, "0")} ${INDO_MONTHS_SHORT[p.month - 1]} ${p.year}`;
}
