import { NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import { getDecryptedToken } from "@/lib/tokens";
import { GitHubApiError } from "./client";

/**
 * The bits every write route needs before it can talk to GitHub: which
 * repository the key stands for, and which token to use for it.
 *
 * Shared rather than repeated per route so that the mapping from a
 * GitHub failure to a message the UI can act on stays one decision.
 */
export interface RepoContext {
  owner: string;
  repo: string;
  tokenId: string | null;
}

export async function resolveRepo(repoKey: string): Promise<RepoContext> {
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

export async function resolveRepoToken(
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
export function toErrorResponse(err: unknown): NextResponse {
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
