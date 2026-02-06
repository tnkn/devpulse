import { promises as fs } from "fs";
import path from "path";
import type { CollectionJob, DumpMetadata } from "@/types";
import { getCommits, getPullRequests, getReleases, getIssues } from "./client";

const DATA_DIR = process.env.DATA_DIR || "./data";
const jobs = new Map<string, CollectionJob>();

function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatTimestamp(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function startCollection(owner: string, repo: string): CollectionJob {
  const id = generateJobId();
  const job: CollectionJob = {
    id,
    owner,
    repo,
    status: "pending",
    progress: "Starting...",
    started_at: new Date().toISOString(),
    completed_at: null,
    error: null,
    dump_path: null,
  };

  jobs.set(id, job);

  // Fire-and-forget
  runCollection(job).catch(() => {
    // Error is captured in job state
  });

  return job;
}

export function getJob(id: string): CollectionJob | undefined {
  return jobs.get(id);
}

async function runCollection(job: CollectionJob): Promise<void> {
  try {
    job.status = "collecting";
    const { owner, repo } = job;
    const dirName = `${owner}__${repo}`;
    const timestamp = formatTimestamp(new Date());
    const dumpDir = path.resolve(DATA_DIR, dirName, timestamp);

    await fs.mkdir(dumpDir, { recursive: true });

    // Collect commits
    job.progress = "Collecting commits...";
    const commits = await getCommits(owner, repo);

    // Collect pull requests
    job.progress = "Collecting pull requests...";
    const pulls = await getPullRequests(owner, repo);

    // Collect releases
    job.progress = "Collecting releases...";
    const releases = await getReleases(owner, repo);

    // Collect issues
    job.progress = "Collecting issues...";
    const issues = await getIssues(owner, repo);

    // Write data files
    job.progress = "Writing data files...";
    const metadata: DumpMetadata = {
      repository: `${owner}/${repo}`,
      repository_url: `https://github.com/${owner}/${repo}`,
      dumped_at: new Date().toISOString(),
      commit_count: commits.length,
      pull_request_count: pulls.length,
      release_count: releases.length,
      issue_count: issues.length,
    };

    await Promise.all([
      fs.writeFile(path.join(dumpDir, "metadata.json"), JSON.stringify(metadata, null, 2)),
      fs.writeFile(path.join(dumpDir, "commits.json"), JSON.stringify(commits, null, 2)),
      fs.writeFile(path.join(dumpDir, "pulls.json"), JSON.stringify(pulls, null, 2)),
      fs.writeFile(path.join(dumpDir, "releases.json"), JSON.stringify(releases, null, 2)),
      fs.writeFile(path.join(dumpDir, "issues.json"), JSON.stringify(issues, null, 2)),
    ]);

    job.status = "completed";
    job.progress = `Done! ${commits.length} commits, ${pulls.length} PRs, ${releases.length} releases, ${issues.length} issues`;
    job.completed_at = new Date().toISOString();
    job.dump_path = `${dirName}/${timestamp}`;
  } catch (err) {
    job.status = "failed";
    job.error = err instanceof Error ? err.message : "Unknown error";
    job.progress = "Failed";
    job.completed_at = new Date().toISOString();
  }
}
