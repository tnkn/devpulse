import { promises as fs } from "fs";
import path from "path";
import type { DuckDBConnection } from "@duckdb/node-api";
import type { Commit, PullRequest, Release, Issue, DumpMetadata } from "@/types";
import { upsertCommits, upsertPullRequests, upsertReleases, upsertIssues, upsertMetadata } from "./upsert";

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

async function findLatestDump(repoDir: string): Promise<string | null> {
  try {
    const entries = await fs.readdir(repoDir, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    dirs.sort();
    for (let i = dirs.length - 1; i >= 0; i--) {
      const candidate = path.join(repoDir, dirs[i]);
      try {
        await fs.access(path.join(candidate, "metadata.json"));
        return candidate;
      } catch {
        continue;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function migrateJsonToDb(conn: DuckDBConnection, repoDir: string): Promise<boolean> {
  const dumpPath = await findLatestDump(repoDir);
  if (!dumpPath) return false;

  console.log(`[migrate] Migrating JSON data from ${dumpPath}`);

  const [metadata, commits, pulls, releases, issues] = await Promise.all([
    readJsonFile<DumpMetadata>(path.join(dumpPath, "metadata.json")),
    readJsonFile<Commit[]>(path.join(dumpPath, "commits.json")),
    readJsonFile<PullRequest[]>(path.join(dumpPath, "pulls.json")),
    readJsonFile<Release[]>(path.join(dumpPath, "releases.json")),
    readJsonFile<Issue[]>(path.join(dumpPath, "issues.json")),
  ]);

  await upsertCommits(conn, commits || []);
  await upsertPullRequests(conn, pulls || []);
  await upsertReleases(conn, releases || []);
  await upsertIssues(conn, issues || []);

  if (metadata) {
    await upsertMetadata(conn, metadata.repository, metadata.repository_url);
  }

  console.log(`[migrate] Migration complete: ${commits?.length ?? 0} commits, ${pulls?.length ?? 0} PRs, ${releases?.length ?? 0} releases, ${issues?.length ?? 0} issues`);
  return true;
}
