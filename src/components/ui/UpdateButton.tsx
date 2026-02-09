"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { CollectionJob } from "@/types";

interface Props {
  owner: string;
  repo: string;
}

export function UpdateButton({ owner, repo }: Props) {
  const router = useRouter();
  const [job, setJob] = useState<CollectionJob | null>(null);

  const isRunning = job && (job.status === "pending" || job.status === "collecting");

  const startUpdate = useCallback(async () => {
    try {
      const res = await fetch("/api/github/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start");
      setJob(data);
    } catch {
      setJob(null);
    }
  }, [owner, repo]);

  // Poll job status
  useEffect(() => {
    if (!isRunning || !job) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/github/collect/status?id=${job.id}`);
        if (res.ok) {
          const updated = await res.json();
          setJob(updated);
          if (updated.status === "completed") {
            router.refresh();
          }
        }
      } catch {
        // ignore
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isRunning, job, router]);

  if (isRunning) {
    return (
      <div className="inline-flex items-center gap-2 px-4 py-2 text-sm text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-700 rounded">
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span>{job?.progress}</span>
      </div>
    );
  }

  if (job?.status === "failed") {
    return (
      <div className="inline-flex items-center gap-2">
        <span className="text-sm text-red-600 dark:text-red-400" title={job.error || undefined}>
          Update failed
        </span>
        <button
          onClick={startUpdate}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={startUpdate}
      className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
    >
      Update
    </button>
  );
}
