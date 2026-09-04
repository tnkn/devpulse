/**
 * The start-point filters as URL query parameters.
 *
 * They are the one piece of this page's state a person expects to keep:
 * a filtered graph is what gets bookmarked and pasted into a review, and
 * losing it to a reload — or to the reload that follows pressing Update —
 * means picking twenty issues out of the list again.
 */

export const LABEL_PARAM = "label";
export const ISSUES_PARAM = "issues";

export interface DependencyFilters {
  /** Empty string means no label filter. */
  label: string;
  issueNumbers: number[];
}

export const EMPTY_FILTERS: DependencyFilters = { label: "", issueNumbers: [] };

/** Next hands a repeated parameter over as an array; take the first. */
function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/**
 * Reads the filters out of a query string, keeping only values the data
 * can actually show.
 *
 * A hand-edited or stale URL is the normal case here, not an exotic one:
 * links get shared, and labels and issues come and go. An unknown value is
 * dropped rather than kept, because the controls cannot display it — a
 * `<select>` has no option for a deleted label, and the issue picker only
 * lists issues it was given — so keeping it would leave the toolbar
 * showing no filter while the graph was filtered by one.
 */
export function parseDependencyFilters(
  query: { [key: string]: string | string[] | undefined },
  known: { labels: ReadonlySet<string>; issueNumbers: ReadonlySet<number> },
): DependencyFilters {
  const label = first(query[LABEL_PARAM]);
  const seen = new Set<number>();
  for (const part of first(query[ISSUES_PARAM]).split(",")) {
    const trimmed = part.trim();
    if (!/^\d+$/.test(trimmed)) continue;
    const parsed = Number.parseInt(trimmed, 10);
    if (known.issueNumbers.has(parsed)) seen.add(parsed);
  }
  return {
    label: known.labels.has(label) ? label : "",
    issueNumbers: [...seen],
  };
}

/**
 * Builds the query string for a set of filters, preserving any other
 * parameter already on the URL and dropping a filter that is not set, so
 * an unfiltered graph has a clean address.
 *
 * Issue numbers are sorted so that the same selection always produces the
 * same URL however it was picked — two people sharing a link should not
 * get addresses that differ only in click order.
 */
export function dependencyFiltersToQuery(
  existing: URLSearchParams,
  filters: DependencyFilters,
): string {
  const next = new URLSearchParams(existing);

  if (filters.label) next.set(LABEL_PARAM, filters.label);
  else next.delete(LABEL_PARAM);

  if (filters.issueNumbers.length > 0) {
    next.set(
      ISSUES_PARAM,
      [...filters.issueNumbers].sort((a, b) => a - b).join(","),
    );
  } else {
    next.delete(ISSUES_PARAM);
  }

  // toString percent-encodes the separator, giving "issues=401%2C402".
  // A comma is legal unencoded in a query string, and these URLs get
  // pasted into reviews, so put it back. Only the issues list is ever
  // split on commas, so decoding them in other values changes nothing:
  // URLSearchParams reads "label=a,b" back as the single value "a,b".
  const query = next.toString().replaceAll("%2C", ",");
  return query ? `?${query}` : "";
}
