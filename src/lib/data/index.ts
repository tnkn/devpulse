import { promises as fs } from "fs";
import path from "path";
import type {
  Repository,
  DumpInfo,
  DumpMetadata,
  Commit,
  PullRequest,
  Release,
  Issue,
} from "@/types";

const DATA_DIR = process.env.DATA_DIR || "./data";

export async function getRepositories(): Promise<Repository[]> {
  const dataPath = path.resolve(DATA_DIR);

  try {
    const entries = await fs.readdir(dataPath, { withFileTypes: true });
    const repositories: Repository[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const dumps = await getDumps(entry.name);
        repositories.push({
          name: entry.name,
          dumps,
        });
      }
    }

    return repositories;
  } catch {
    return [];
  }
}

export async function getDumps(repoName: string): Promise<DumpInfo[]> {
  const repoPath = path.resolve(DATA_DIR, repoName);

  try {
    const entries = await fs.readdir(repoPath, { withFileTypes: true });
    const dumps: DumpInfo[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        dumps.push({
          id: entry.name,
          timestamp: parseDumpTimestamp(entry.name),
          path: path.join(repoPath, entry.name),
        });
      }
    }

    // 新しい順にソート
    dumps.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return dumps;
  } catch {
    return [];
  }
}

function parseDumpTimestamp(dumpId: string): string {
  // Format: YYYYMMDD_HHMMSS -> ISO string
  const match = dumpId.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/);
  if (match) {
    const [, year, month, day, hour, minute, second] = match;
    return new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    ).toISOString();
  }
  return dumpId;
}

export async function getDumpData(repoName: string, dumpId: string) {
  const dumpPath = path.resolve(DATA_DIR, repoName, dumpId);

  const [metadata, commits, pulls, releases, issues] = await Promise.all([
    readJsonFile<DumpMetadata>(path.join(dumpPath, "metadata.json")),
    readJsonFile<Commit[]>(path.join(dumpPath, "commits.json")),
    readJsonFile<PullRequest[]>(path.join(dumpPath, "pulls.json")),
    readJsonFile<Release[]>(path.join(dumpPath, "releases.json")),
    readJsonFile<Issue[]>(path.join(dumpPath, "issues.json")),
  ]);

  return {
    metadata,
    commits: commits || [],
    pulls: pulls || [],
    releases: releases || [],
    issues: issues || [],
  };
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}
