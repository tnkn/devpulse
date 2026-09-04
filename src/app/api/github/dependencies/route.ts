import { type NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import {
  cacheIssueDependency,
  getIssueGlobalId,
  listIssueDependencies,
  uncacheIssueDependency,
} from "@/lib/db/upsert";
import { addIssueBlockedBy, removeIssueBlockedBy } from "@/lib/github/client";
import {
  resolveRepo,
  resolveRepoToken,
  toErrorResponse,
} from "@/lib/github/repo-context";

/**
 * GitHub owns issue dependencies, so writes go there first and the local
 * table is only updated once GitHub has accepted the change.
 */

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
    return toErrorResponse(err);
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
    const token = await resolveRepoToken(tokenId);

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
    return toErrorResponse(err);
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
    const token = await resolveRepoToken(tokenId);

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
    return toErrorResponse(err);
  }
}
