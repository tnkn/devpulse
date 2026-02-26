"use client";

import { useState, useEffect, useCallback } from "react";
import type { GitHubRepository, GitHubTokenMasked, CollectionJob } from "@/types";
import { useI18n } from "@/lib/i18n";

interface TokenOption {
  id: string;
  label: string;
}

export function RepositorySelector() {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [ownOnly, setOwnOnly] = useState(false);
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeJobs, setActiveJobs] = useState<Map<string, CollectionJob>>(new Map());
  const [tokenOptions, setTokenOptions] = useState<TokenOption[]>([]);
  const [selectedTokenId, setSelectedTokenId] = useState<string>("");

  const fetchRepositories = useCallback(async (searchQuery?: string, filterOwnOnly?: boolean, tokenId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("q", searchQuery);
      if (filterOwnOnly) params.set("affiliation", "owner,organization_member");
      if (tokenId) params.set("token_id", tokenId);
      params.set("per_page", "20");
      const res = await fetch(`/api/github/repos?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch");
      setRepositories(data.repositories || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch repositories");
      setRepositories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch token list when modal opens
  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/settings/tokens")
      .then((res) => res.json())
      .then((data) => {
        const opts: TokenOption[] = [];
        if (data.hasEnvToken) opts.push({ id: "env", label: "GITHUB_TOKEN (env)" });
        for (const t of data.tokens ?? []) {
          opts.push({
            id: t.id,
            label: `${t.label} (****${t.token_suffix})${t.is_default ? " \u2605" : ""}`,
          });
        }
        setTokenOptions(opts);
        // Default to the DB default token
        const def = (data.tokens ?? []).find((t: GitHubTokenMasked) => t.is_default);
        if (def) setSelectedTokenId(def.id);
      })
      .catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    fetchRepositories(query || undefined, ownOnly, selectedTokenId);
  }, [isOpen, ownOnly, selectedTokenId, fetchRepositories]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      fetchRepositories(query || undefined, ownOnly, selectedTokenId);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, isOpen, ownOnly, selectedTokenId, fetchRepositories]);

  // Poll active jobs
  useEffect(() => {
    const polling = activeJobs.size > 0;
    if (!polling) return;

    const interval = setInterval(async () => {
      const updates = new Map(activeJobs);
      let changed = false;
      for (const [repoKey, job] of updates) {
        if (job.status === "completed" || job.status === "failed") continue;
        try {
          const res = await fetch(`/api/github/collect/status?id=${job.id}`);
          if (res.ok) {
            const updated = await res.json();
            updates.set(repoKey, updated);
            changed = true;
          }
        } catch {
          // ignore polling errors
        }
      }
      if (changed) setActiveJobs(new Map(updates));
    }, 2000);

    return () => clearInterval(interval);
  }, [activeJobs]);

  const startCollect = async (repo: GitHubRepository) => {
    const repoKey = repo.full_name;
    try {
      const res = await fetch("/api/github/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: repo.owner.login, repo: repo.name, token_id: selectedTokenId }),
      });
      const job = await res.json();
      if (!res.ok) throw new Error(job.error || "Failed to start collection");
      setActiveJobs((prev) => new Map(prev).set(repoKey, job));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start collection");
    }
  };

  const getJobForRepo = (fullName: string): CollectionJob | undefined => {
    return activeJobs.get(fullName);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
      >
        {t.repoSelector.addRepository}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-16">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold">{t.repoSelector.addRepository}</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-2">
          <input
            type="text"
            placeholder={t.repoSelector.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={ownOnly}
              onChange={(e) => setOwnOnly(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            {t.repoSelector.ownerOnly}
          </label>
          {tokenOptions.length > 1 && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span>{t.repoSelector.token}:</span>
              <select
                value={selectedTokenId}
                onChange={(e) => setSelectedTokenId(e.target.value)}
                className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm"
              >
                {tokenOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Repository list */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && repositories.length === 0 ? (
            <div className="text-center text-gray-500 py-8">{t.common.loading}</div>
          ) : repositories.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              {t.repoSelector.noReposFound}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {repositories.map((repo) => {
                const job = getJobForRepo(repo.full_name);
                return (
                  <RepoCard
                    key={repo.id}
                    repo={repo}
                    job={job}
                    onCollect={() => startCollect(repo)}
                    t={t}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RepoCard({
  repo,
  job,
  onCollect,
  t,
}: {
  repo: GitHubRepository;
  job?: CollectionJob;
  onCollect: () => void;
  t: ReturnType<typeof useI18n>["t"];
}) {
  const isCollecting = job && (job.status === "pending" || job.status === "collecting");
  const isCompleted = job?.status === "completed";
  const isFailed = job?.status === "failed";

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="font-medium text-sm truncate" title={repo.full_name}>
          {repo.full_name}
        </h3>
        {repo.private && (
          <span className="text-xs px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded shrink-0">
            {t.repoSelector.private}
          </span>
        )}
      </div>

      {repo.description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">
          {repo.description}
        </p>
      )}

      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-2">
        {repo.language && <span>{repo.language}</span>}
        <span>&#9733; {repo.stargazers_count}</span>
      </div>

      {/* Action area */}
      {isCollecting ? (
        <div className="text-xs text-blue-600 dark:text-blue-400">
          <div className="flex items-center gap-2">
            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>{job?.progress}</span>
          </div>
        </div>
      ) : isCompleted ? (
        <div className="flex items-center justify-between">
          <span className="text-xs text-green-600 dark:text-green-400">
            {t.repoSelector.collectionComplete}
          </span>
          <a
            href={`/${job?.dump_path}`}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            {t.repoSelector.view}
          </a>
        </div>
      ) : isFailed ? (
        <div className="flex items-center justify-between">
          <span className="text-xs text-red-600 dark:text-red-400" title={job?.error || undefined}>
            {t.repoSelector.failed}
          </span>
          <button
            onClick={onCollect}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            {t.repoSelector.retry}
          </button>
        </div>
      ) : (
        <button
          onClick={onCollect}
          className="w-full px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          {t.repoSelector.collect}
        </button>
      )}
    </div>
  );
}
