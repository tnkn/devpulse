"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { CollectionJob, GitHubTokenMasked } from "@/types";
import { useI18n } from "@/lib/i18n";

interface Props {
  owner: string;
  repo: string;
  tokenId?: string | null;
}

export function UpdateButton({ owner, repo, tokenId }: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const [job, setJob] = useState<CollectionJob | null>(null);
  const [tokens, setTokens] = useState<GitHubTokenMasked[]>([]);
  const [selectedTokenId, setSelectedTokenId] = useState<string>(tokenId || "env");
  const [hasEnvToken, setHasEnvToken] = useState(false);

  const isRunning = job && (job.status === "pending" || job.status === "collecting");

  // Fetch available tokens
  useEffect(() => {
    fetch("/api/settings/tokens")
      .then((res) => res.json())
      .then((data) => {
        setTokens(data.tokens ?? []);
        setHasEnvToken(data.hasEnvToken ?? false);
        // If no tokenId was saved and no env token, default to the DB default token
        if (!tokenId && !data.hasEnvToken && data.tokens?.length > 0) {
          const def = data.tokens.find((t: GitHubTokenMasked) => t.is_default);
          if (def) setSelectedTokenId(def.id);
        }
      })
      .catch(() => {});
  }, [tokenId]);

  const startUpdate = useCallback(async () => {
    try {
      const res = await fetch("/api/github/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner,
          repo,
          token_id: selectedTokenId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start");
      setJob(data);
    } catch {
      setJob(null);
    }
  }, [owner, repo, selectedTokenId]);

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

  const showTokenSelector = tokens.length > 0 || hasEnvToken;
  const tokenOptions = [
    ...(hasEnvToken ? [{ id: "env", label: "GITHUB_TOKEN (env)" }] : []),
    ...tokens.map((t) => ({
      id: t.id,
      label: `${t.label} (****${t.token_suffix})${t.is_default ? " \u2605" : ""}`,
    })),
  ];

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
          {t.updateButton.updateFailed}
        </span>
        <button
          onClick={startUpdate}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          {t.updateButton.retry}
        </button>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2">
      {showTokenSelector && tokenOptions.length > 1 && (
        <select
          value={selectedTokenId}
          onChange={(e) => setSelectedTokenId(e.target.value)}
          className="px-2 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
        >
          {tokenOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      )}
      <button
        onClick={startUpdate}
        className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
      >
        {t.updateButton.update}
      </button>
    </div>
  );
}
