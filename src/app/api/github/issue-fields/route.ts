import { type NextRequest, NextResponse } from "next/server";
import { checkpoint, getConnection } from "@/lib/db";
import {
  getIssueProjectItem,
  listProjectFields,
  setIssueFieldsLocally,
} from "@/lib/db/upsert";
import {
  getAssignableUsers,
  resolveToken,
  setIssueAssignees,
} from "@/lib/github/client";
import {
  ProjectFieldValueError,
  ProjectsUnavailableError,
  setProjectFieldValue,
} from "@/lib/github/projects";
import {
  resolveRepo,
  resolveRepoToken,
  toErrorResponse,
} from "@/lib/github/repo-context";

/**
 * Editing Priority, Size and Assignees.
 *
 * GitHub is the source of truth exactly as it is for dependencies: the
 * change goes there first, and the local row is only updated once
 * GitHub has accepted it. A refused edit leaves the table showing what
 * GitHub still holds, which is the truthful thing to show.
 *
 * The two halves reach GitHub differently — assignees through the REST
 * issue endpoint, Priority and Size through a Projects v2 mutation —
 * but they are one route because they are one gesture to the reader.
 */

interface EditBody {
  issue_number?: number;
  field?: string;
  /** For priority and size. Null or "" clears the field. */
  value?: string | null;
  /** For assignees: the complete set the issue should end up with. */
  assignees?: string[];
}

/** The options each editable cell may offer, for rendering the pickers. */
export async function GET(request: NextRequest) {
  try {
    const repoKey = request.nextUrl.searchParams.get("key");
    if (!repoKey) {
      return NextResponse.json({ error: "key is required" }, { status: 400 });
    }

    const conn = await getConnection(repoKey);
    let fields: Awaited<ReturnType<typeof listProjectFields>>;
    try {
      fields = await listProjectFields(conn);
    } finally {
      conn.closeSync();
    }

    const { owner, repo, tokenId } = await resolveRepo(repoKey);
    const token = await resolveRepoToken(tokenId);

    // A repository whose collaborators cannot be listed is still worth
    // answering for: the project fields alone make two of three cells
    // editable, so this degrades rather than fails.
    let assignableUsers: string[] = [];
    try {
      assignableUsers = await getAssignableUsers(owner, repo, token);
    } catch (err) {
      console.warn(
        `[issue-fields] Could not list assignable users: ${err instanceof Error ? err.message : err}`,
      );
    }

    return NextResponse.json({ fields, assignableUsers });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const repoKey = request.nextUrl.searchParams.get("key");
    if (!repoKey) {
      return NextResponse.json({ error: "key is required" }, { status: 400 });
    }

    const body = (await request.json()) as EditBody;
    const issueNumber = body.issue_number;
    if (typeof issueNumber !== "number") {
      return NextResponse.json(
        { error: "issue_number is required" },
        { status: 400 },
      );
    }

    const { owner, repo, tokenId } = await resolveRepo(repoKey);
    const token = await resolveRepoToken(tokenId);

    if (body.field === "assignees") {
      const wanted = body.assignees ?? [];
      const applied = await setIssueAssignees(
        owner,
        repo,
        issueNumber,
        wanted,
        token,
      );
      const conn = await getConnection(repoKey);
      try {
        await setIssueFieldsLocally(conn, issueNumber, { assignees: applied });
      } finally {
        conn.closeSync();
      }
      await checkpoint(repoKey);
      return NextResponse.json({ assignees: applied });
    }

    if (body.field !== "priority" && body.field !== "size") {
      return NextResponse.json(
        { error: "field must be priority, size or assignees" },
        { status: 400 },
      );
    }

    const conn = await getConnection(repoKey);
    let definition:
      | Awaited<ReturnType<typeof listProjectFields>>[number]
      | null;
    let item: Awaited<ReturnType<typeof getIssueProjectItem>>;
    try {
      const definitions = await listProjectFields(conn);
      item = await getIssueProjectItem(conn, issueNumber);
      definition =
        definitions.find(
          (d) => d.kind === body.field && d.projectId === item?.projectId,
        ) ?? null;
    } finally {
      conn.closeSync();
    }

    if (!item) {
      return NextResponse.json(
        {
          error:
            "This issue is not on a project board, so it has no Priority or Size to set. Add it to a board on GitHub first.",
          code: "not_on_board",
        },
        { status: 409 },
      );
    }
    if (!definition) {
      return NextResponse.json(
        {
          error: `The board this issue is on has no ${body.field} field. Run Update to refresh the board's fields.`,
          code: "no_such_field",
        },
        { status: 409 },
      );
    }

    const value = body.value ?? null;
    // resolveToken rather than the raw job token: the GraphQL side needs
    // a concrete bearer, and the fallbacks (DB default, then env) live
    // in one place.
    await setProjectFieldValue(
      await resolveToken(token),
      definition,
      item.projectItemId,
      value,
    );

    const stored = value === null || value.trim() === "" ? null : value.trim();
    const write = await getConnection(repoKey);
    try {
      await setIssueFieldsLocally(write, issueNumber, {
        [body.field]: stored,
      });
    } finally {
      write.closeSync();
    }
    await checkpoint(repoKey);

    return NextResponse.json({ [body.field]: stored });
  } catch (err) {
    if (err instanceof ProjectsUnavailableError) {
      return NextResponse.json(
        { error: err.message, code: "forbidden" },
        { status: 403 },
      );
    }
    if (err instanceof ProjectFieldValueError) {
      return NextResponse.json(
        { error: err.message, code: "rejected" },
        { status: 422 },
      );
    }
    return toErrorResponse(err);
  }
}
