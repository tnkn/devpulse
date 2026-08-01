import type { Locale } from "./messages";

const localeMap: Record<Locale, string> = {
  en: "en-US",
  ja: "ja-JP",
};

/**
 * Convert ISO week period string to Monday date of that week.
 */
function weekToMonday(period: string): Date {
  const [yearStr, weekStr] = period.split("-W");
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekStr, 10);
  const jan4 = new Date(year, 0, 4);
  const dow = jan4.getDay() || 7;
  const firstMonday = new Date(jan4);
  firstMonday.setDate(jan4.getDate() - dow + 1);
  const target = new Date(firstMonday);
  target.setDate(firstMonday.getDate() + (week - 1) * 7);
  return target;
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/**
 * Format a period string for display.
 * @param style "full" for tables/tooltips, "compact" for chart X-axis
 *
 * day   → "01/15"
 * week  → full: "01/13 ~ 01/19" / compact: "01/13~"
 * month → "2025/01"
 */
export function formatPeriod(
  period: string,
  style: "compact" | "full" = "full",
): string {
  // day: YYYY-MM-DD → MM/DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) {
    const [, m, d] = period.split("-");
    return `${m}/${d}`;
  }

  // week: YYYY-Www → MM/DD ~ MM/DD or MM/DD~
  if (period.includes("-W")) {
    const monday = weekToMonday(period);
    const mm = pad2(monday.getMonth() + 1);
    const dd = pad2(monday.getDate());
    if (style === "compact") {
      return `${mm}/${dd}~`;
    }
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const mm2 = pad2(sunday.getMonth() + 1);
    const dd2 = pad2(sunday.getDate());
    return `${mm}/${dd} ~ ${mm2}/${dd2}`;
  }

  // month: YYYY-MM → YYYY/MM
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [y, m] = period.split("-");
    return `${y}/${m}`;
  }

  return period;
}

export function formatTimestamp(isoString: string, locale: Locale): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString(localeMap[locale], {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}
