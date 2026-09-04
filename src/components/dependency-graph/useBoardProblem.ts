"use client";

import { useMemo } from "react";
import { decodeProjectError } from "@/lib/dependencies/project-error";
import { useI18n } from "@/lib/i18n";
import type { ProjectFieldDefinition } from "@/types";

/**
 * Why no issue in this repository can have its Priority or Size read or
 * edited, or undefined when the board is usable.
 *
 * This is a property of the repository rather than of any one issue, so
 * both views announce it once, in view, instead of leaving it on a
 * tooltip: an issue with nothing set renders a grey dash, and a title
 * attribute on a 14-pixel dash — in a column of identical dashes — is
 * not somewhere anyone thinks to look. A board whose fields are simply
 * named something else is the case that looks most like a bug from the
 * outside, so the message names what the board actually calls them.
 *
 * Shared by the graph and the table so the two cannot disagree about
 * whether there is a problem, or word it differently.
 */
export function useBoardProblem(
  projectFields: ProjectFieldDefinition[],
  projectFieldsSyncedAt: string | null,
  projectFieldsError: string | null,
): string | undefined {
  const { t } = useI18n();
  return useMemo(() => {
    // A refusal outranks "not collected yet": both leave the timestamp
    // unset, but only one of them is fixed by pressing Update, and
    // telling someone to press a button they have already pressed is how
    // this went unexplained for so long.
    const failure = decodeProjectError(projectFieldsError);
    if (failure) {
      // Only a refusal earns the advice about token scopes. Our own bug
      // wearing that message sends the reader to their token settings to
      // fix something that was never wrong.
      return failure.kind === "denied"
        ? t.dependencies.projectsUnreadable(failure.message)
        : t.dependencies.projectsFailed(failure.message);
    }
    if (projectFieldsSyncedAt === null) {
      return t.dependencies.projectsNotCollected;
    }
    // "other" fields are kept by the collector only so this message can
    // name them; a board is usable when at least one field matched.
    if (projectFields.some((d) => d.kind !== "other")) return undefined;
    const seen = projectFields.map((d) => d.fieldName);
    return seen.length > 0
      ? t.dependencies.noProjectFieldsFound(seen.join(", "))
      : t.dependencies.noProjectFields;
  }, [projectFields, projectFieldsSyncedAt, projectFieldsError, t]);
}
