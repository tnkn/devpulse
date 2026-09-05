/**
 * How a Priority or Size field is recognised by name.
 *
 * Shared by the two places a value can come from — a Projects v2 board
 * and GitHub's native issue fields — so the same board wording is read
 * the same way whichever API it arrives through.
 *
 * Matched on containment rather than equality, because these get renamed
 * constantly — "Priority Level", "Prio", "優先度", "🔥 Priority", "Size
 * (t-shirt)" — and an exact match reads none of them, silently. The cost
 * of being generous is a field called something like "Sizing notes"
 * being picked up; the cost of being strict is the feature appearing
 * broken with no way to tell why, which is far worse.
 */
export const PRIORITY_FIELD = /priority|prio\b|優先/i;
export const SIZE_FIELD =
  /size|estimate|effort|story\s*points?|\bpoints?\b|\bsp\b|見積|サイズ|規模|工数/i;

export type FieldKind = "priority" | "size";

/** Which of the two a field name reads as, or null for neither. */
export function matchFieldKind(name: string): FieldKind | null {
  if (PRIORITY_FIELD.test(name)) return "priority";
  if (SIZE_FIELD.test(name)) return "size";
  return null;
}
