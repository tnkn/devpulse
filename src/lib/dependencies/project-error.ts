/**
 * How a failure to read Projects is stored, and read back.
 *
 * Two kinds of failure reach the same column and need opposite advice:
 * a refusal is the reader's to fix by widening the token, while anything
 * else — a malformed query, an outage — is ours, and telling someone to
 * go and edit their token scopes for our bug wastes their afternoon.
 *
 * Stored as one prefixed string rather than a second column: the kind is
 * only ever read together with the message, and the metadata row is
 * rewritten wholesale on every collection, so each added column is
 * another positional bind to keep in step.
 */

export type ProjectErrorKind = "denied" | "failed";

export interface ProjectError {
  kind: ProjectErrorKind;
  message: string;
}

export function encodeProjectError(
  kind: ProjectErrorKind,
  message: string,
): string {
  return `${kind}:${message}`;
}

/** Anything unrecognised is treated as "failed": claiming a permission problem we cannot prove is the worse mistake. */
export function decodeProjectError(stored: string | null): ProjectError | null {
  if (stored === null) return null;
  const separator = stored.indexOf(":");
  const kind = separator === -1 ? "" : stored.slice(0, separator);
  return kind === "denied" || kind === "failed"
    ? { kind, message: stored.slice(separator + 1) }
    : { kind: "failed", message: stored };
}
