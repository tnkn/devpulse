import { type NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import {
  cacheIssueDependency,
  getIssueGlobalId,
  listIssueDependencies,
  uncacheIssueDependency,
} from "@/lib/db/upsert";
import {
  addIssueBlockedBy,
  GitHubApiError,
  removeIssueBlockedBy,
} from "@/lib/github/client";
import { getDecryptedToken } from "@/lib/tokens";

/**
 * GitHub owns issue dependencies, so writes go there first and the local
 * table is only updated once GitHub has accepted the change.
 */
async function resolveRepo(
  repoKey: string,
): Promise<{ owner: string; repo: string; tokenId: string | null }> {
  const conn = await getConnection(repoKey);
  try {
    const reader = await conn.runAndReadAll(
      "SELECT full_name, token_id FROM metadata LIMIT 1",
    );
    const rows = reader.getRows();
    const fullName = rows[0]?.[0] != null ? String(rows[0][0]) : null;
    if (!fullName) {
      throw new Error("Repository metadata not found. Collect it first.");
    }
    const [owner, repo] = fullName.split("/");
    return {
      owner,
      repo,
      tokenId: rows[0]?.[1] != null ? String(rows[0][1]) : null,
    };
  } finally {
    conn.closeSync();
  }
}

async function resolveToken(
  tokenId: string | null,
): Promise<string | undefined> {
  if (!tokenId) return undefined;
  if (tokenId === "env") return process.env.GITHUB_TOKEN;
  try {
    return (await getDecryptedToken(tokenId)) || undefined;
  } catch {
    return undefined;
  }
}

/** Turns a GitHub failure into a message the UI can act on. */
function toResponse(err: unknown): NextResponse {
  if (err instanceof GitHubApiError) {
    const code =
      err.status === 403 || err.status === 401
        ? "forbidden"
        : err.status === 422
          ? "rejected"
          : err.status === 404
            ? "not_found"
            : "github_error";
    return NextResponse.json(
      { error: err.message, code },
      { status: err.status === 401 ? 403 : err.status },
    );
  }
  const message = err instanceof Error ? err.message : "Unknown error";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const repoKey = request.nextUrl.searchParams.get("key");
    if (!repoKey) {
      return NextResponse.json({ error: "key is required" }, { status: 400 });
    }

    const conn = await getConnection(repoKey);
    try {
      const edges = await listIssueDependencies(conn);
      return NextResponse.json({ edges });
    } finally {
      conn.closeSync();
    }
  } catch (err) {
    return toResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const repoKey = request.nextUrl.searchParams.get("key");
    if (!repoKey) {
      return NextResponse.json({ error: "key is required" }, { status: 400 });
    }

    const body = await request.json();
    const { blocker_number, blocked_number } = body as {
      blocker_number: number;
      blocked_number: number;
    };
    if (
      !Number.isInteger(blocker_number) ||
      !Number.isInteger(blocked_number)
    ) {
      return NextResponse.json(
        { error: "blocker_number and blocked_number are required" },
        { status: 400 },
      );
    }

    const { owner, repo, tokenId } = await resolveRepo(repoKey);
    const token = await resolveToken(tokenId);

    const conn = await getConnection(repoKey);
    try {
      // The dependencies API identifies the blocker by its global id.
      const blockerId = await getIssueGlobalId(conn, blocker_number);
      if (blockerId === null) {
        return NextResponse.json(
          {
            error: `Issue #${blocker_number} has no stored GitHub id. Run Update to refresh the repository.`,
            code: "missing_issue_id",
          },
          { status: 409 },
        );
      }

      await addIssueBlockedBy(owner, repo, blocked_number, blockerId, token);
      await cacheIssueDependency(conn, blocker_number, blocked_number);
      const edges = await listIssueDependencies(conn);
      return NextResponse.json({ edges });
    } finally {
      conn.closeSync();
    }
  } catch (err) {
    return toResponse(err);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const repoKey = request.nextUrl.searchParams.get("key");
    const blockerParam = request.nextUrl.searchParams.get("blocker");
    const blockedParam = request.nextUrl.searchParams.get("blocked");

    if (!repoKey || blockerParam === null || blockedParam === null) {
      return NextResponse.json(
        { error: "key, blocker and blocked are required" },
        { status: 400 },
      );
    }
    const blocker = Number(blockerParam);
    const blocked = Number(blockedParam);
    if (!Number.isInteger(blocker) || !Number.isInteger(blocked)) {
      return NextResponse.json(
        { error: "blocker and blocked must be issue numbers" },
        { status: 400 },
      );
    }

    const { owner, repo, tokenId } = await resolveRepo(repoKey);
    const token = await resolveToken(tokenId);

    const conn = await getConnection(repoKey);
    try {
      const blockerId = await getIssueGlobalId(conn, blocker);
      if (blockerId === null) {
        return NextResponse.json(
          {
            error: `Issue #${blocker} has no stored GitHub id. Run Update to refresh the repository.`,
            code: "missing_issue_id",
          },
          { status: 409 },
        );
      }

      await removeIssueBlockedBy(owner, repo, blocked, blockerId, token);
      await uncacheIssueDependency(conn, blocker, blocked);
      const edges = await listIssueDependencies(conn);
      return NextResponse.json({ edges });
    } finally {
      conn.closeSync();
    }
  } catch (err) {
    return toResponse(err);
  }
}
