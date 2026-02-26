import { cookies } from "next/headers";
import { messages, type Locale, type Messages } from "./messages";

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const locale = cookieStore.get("locale")?.value;
  return locale === "ja" ? "ja" : "en";
}

export async function getMessages(): Promise<Messages> {
  const locale = await getLocale();
  return messages[locale];
}
