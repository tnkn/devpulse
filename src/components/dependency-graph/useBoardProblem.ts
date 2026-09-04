"use client";

import { useMemo } from "react";
import { decodeProjectError } from "@/lib/dependencies/project-error";
import { useI18n } from "@/lib/i18n";
import type { ProjectFieldDefinition } from "@/types";

export type ProjectFieldKind = "priority" | "size";

export interface BoardProblem {
  /** Announced once above both views, or undefined when there is nothing to say. */
  notice?: string;
  /** Kinds no field on any board was recognised as. */
  missing: ReadonlySet<ProjectFieldKind>;
  /** Nothing can be read at all: not collected, refused, or failed. */
  blocked: boolean;
}

const NO_KINDS: ReadonlySet<ProjectFieldKind> = new Set();

/**
 * What is wrong with this repository's project boards, if anything.
 *
 * Reported per kind rather than as one verdict. Priority and Size are
 * separate fields that fail separately: a board can name one of them
 * something we do not recognise while the other reads perfectly, and an
 * earlier version of this went quiet the moment *either* matched — so a
 * board with a working Size and an unrecognised Priority explained
 * nothing about the empty column, which is the whole reason the notice
 * exists.
 *
 * Shared by the graph and the table so the two cannot disagree about
 * whether there is a problem, or word it differently.
 */
export function useBoardProblem(
  projectFields: ProjectFieldDefinition[],
  projectFieldsSyncedAt: string | null,
  projectFieldsError: string | null,
): BoardProblem {
  const { t } = useI18n();
  return useMemo(() => {
    const blocked = (notice: string): BoardProblem => ({
      notice,
      missing: new Set<ProjectFieldKind>(["priority", "size"]),
      blocked: true,
    });

    // A refusal outranks "not collected yet": both leave the timestamp
    // unset, but only one of them is fixed by pressing Update, and
    // telling someone to press a button they have already pressed is how
    // this went unexplained for so long.
    const failure = decodeProjectError(projectFieldsError);
    if (failure) {
      // Only a refusal earns the advice about token scopes. Our own bug
      // wearing that message sends the reader to their token settings to
      // fix something that was never wrong.
      return blocked(
        failure.kind === "denied"
          ? t.dependencies.projectsUnreadable(failure.message)
          : t.dependencies.projectsFailed(failure.message),
      );
    }
    if (projectFieldsSyncedAt === null) {
      return blocked(t.dependencies.projectsNotCollected);
    }

    const missing = new Set<ProjectFieldKind>(
      (["priority", "size"] as const).filter(
        (kind) => !projectFields.some((d) => d.kind === kind),
      ),
    );
    if (missing.size === 0) {
      return { missing: NO_KINDS, blocked: false };
    }

    // "other" fields are kept by the collector only so this message can
    // name them: the board's own wording is the one thing that makes a
    // naming mismatch recognisable from the outside.
    const seen = projectFields.map((d) => d.fieldName);
    return {
      notice:
        seen.length > 0
          ? t.dependencies.noProjectFieldsFound(
              missing.has("priority"),
              missing.has("size"),
              seen.join(", "),
            )
          : t.dependencies.noProjectFields,
      missing,
      blocked: false,
    };
  }, [projectFields, projectFieldsSyncedAt, projectFieldsError, t]);
}
