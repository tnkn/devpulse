import type { Locale } from "./messages";

const localeMap: Record<Locale, string> = {
  en: "en-US",
  ja: "ja-JP",
};

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
