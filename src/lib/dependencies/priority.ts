/** How urgent a priority value reads, once its wording is set aside. */
export type PriorityRank = "high" | "medium" | "low";

/**
 * Boards word priority differently — "P0", "Urgent", "High", "🔴 高" —
 * and the graph only needs to know how loudly to draw it. Anything
 * unrecognised keeps its badge but gets no emphasis: showing the value
 * as written is right, guessing at its urgency is not.
 *
 * Checked most urgent first so that "Very Low" is low and not a "low"
 * that happened to match something else along the way.
 */
const RANK_PATTERNS: [PriorityRank, RegExp][] = [
  ["high", /\b(p0|p1)\b|urgent|critical|blocker|highest|high|緊急|最優先|高/i],
  ["medium", /\b(p2)\b|medium|moderate|normal|中/i],
  ["low", /\b(p3|p4|p5)\b|lowest|low|minor|trivial|低/i],
];

export function priorityRank(priority?: string | null): PriorityRank | null {
  if (!priority) return null;
  for (const [rank, pattern] of RANK_PATTERNS) {
    if (pattern.test(priority)) return rank;
  }
  return null;
}

/**
 * Orders issues by urgency for sorting, with unranked values last: an
 * issue nobody has prioritised is not more urgent than one marked low.
 */
export function priorityOrder(priority?: string | null): number {
  switch (priorityRank(priority)) {
    case "high":
      return 0;
    case "medium":
      return 1;
    case "low":
      return 2;
    default:
      return 3;
  }
}

/**
 * Orders sizes from smallest to largest for sorting.
 *
 * A numeric size is story points, and sorts by value. A t-shirt size
 * sorts by the scale below. Anything else sorts last, alphabetically,
 * so an unrecognised scale still groups its like values together.
 */
const SHIRT_SIZES = [
  "xxs",
  "xs",
  "s",
  "sm",
  "small",
  "m",
  "md",
  "medium",
  "l",
  "lg",
  "large",
  "xl",
  "xxl",
  "xxxl",
];

export function sizeOrder(size?: string | null): number {
  if (!size) return Number.MAX_SAFE_INTEGER;
  const trimmed = size.trim();

  const numeric = Number(trimmed);
  if (!Number.isNaN(numeric)) return numeric;

  const index = SHIRT_SIZES.indexOf(trimmed.toLowerCase());
  // Offset past any plausible story-point count so the two scales do not
  // interleave when a board has switched from one to the other.
  if (index >= 0) return 1000 + index;

  return Number.MAX_SAFE_INTEGER - 1;
}
