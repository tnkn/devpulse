"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LocaleToggle } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { formatTimestamp } from "@/lib/i18n/format";
import type { GitHubTokenMasked, TokenListResponse } from "@/types";

export default function SettingsPage() {
  const { t, locale } = useI18n();
  const [tokens, setTokens] = useState<GitHubTokenMasked[]>([]);
  const [allowTokenUI, setAllowTokenUI] = useState(true);
  const [hasEnvToken, setHasEnvToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchTokens = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/tokens");
      const data: TokenListResponse = await res.json();
      setTokens(data.tokens ?? []);
      setAllowTokenUI(data.allowTokenUI ?? true);
      setHasEnvToken(data.hasEnvToken ?? false);
    } catch (err) {
      console.error("Failed to fetch tokens:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  return (
    <main className="min-h-screen p-8">
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link
                href="/"
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                dev-vis
              </Link>
              <span className="text-gray-400">/</span>
              <h1 className="text-3xl font-bold">{t.settings.title}</h1>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              {t.settings.subtitle}
            </p>
          </div>
          <LocaleToggle />
        </div>
      </header>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">{t.settings.githubTokens}</h2>
          {allowTokenUI && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              {t.settings.addToken}
            </button>
          )}
        </div>

        {!allowTokenUI && (
          <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-sm text-yellow-800 dark:text-yellow-200">
            {t.settings.tokenDisabled}
          </div>
        )}

        {loading ? (
          <p className="text-gray-500">{t.common.loading}</p>
        ) : (
          <div className="space-y-3">
            {hasEnvToken && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">{t.settings.envToken}</span>
                    <span className="ml-2 text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
                      {t.settings.envVariable}
                    </span>
                    {tokens.length === 0 && (
                      <span className="ml-2 text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                        {t.settings.active}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {tokens.length > 0
                    ? t.settings.dbTokenPriority
                    : t.settings.envTokenInUse}
                </p>
              </div>
            )}

            {tokens.map((token) => (
              <TokenCard
                key={token.id}
                token={token}
                allowTokenUI={allowTokenUI}
                onUpdate={fetchTokens}
                t={t}
                locale={locale}
              />
            ))}

            {tokens.length === 0 && !hasEnvToken && (
              <div className="border border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center">
                <p className="text-gray-500 dark:text-gray-400 mb-2">
                  {t.settings.noTokens}
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  {t.settings.noTokensHint}
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      {showAddModal && (
        <AddTokenModal
          onClose={() => setShowAddModal(false)}
          onAdded={fetchTokens}
          t={t}
        />
      )}
    </main>
  );
}

function TokenCard({
  token,
  allowTokenUI,
  onUpdate,
  t,
  locale,
}: {
  token: GitHubTokenMasked;
  allowTokenUI: boolean;
  onUpdate: () => void;
  t: ReturnType<typeof useI18n>["t"];
  locale: ReturnType<typeof useI18n>["locale"];
}) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    valid: boolean;
    login?: string;
    error?: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/settings/tokens/${token.id}/test`, {
        method: "POST",
      });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ valid: false, error: t.settings.requestFailed });
    } finally {
      setTesting(false);
    }
  };

  const handleSetDefault = async () => {
    await fetch(`/api/settings/tokens/${token.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_default: true }),
    });
    onUpdate();
  };

  const handleDelete = async () => {
    if (!confirm(t.settings.deleteToken(token.label))) return;
    setDeleting(true);
    await fetch(`/api/settings/tokens/${token.id}`, { method: "DELETE" });
    onUpdate();
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {token.is_default && (
            <span className="text-yellow-500" title="Default token">
              ★
            </span>
          )}
          <span className="font-medium">{token.label}</span>
          <code className="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
            ****{token.token_suffix}
          </code>
          {token.is_default && (
            <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
              {t.settings.default}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
          >
            {testing ? t.settings.testing : t.settings.test}
          </button>
          {allowTokenUI && !token.is_default && (
            <button
              type="button"
              onClick={handleSetDefault}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              {t.settings.setDefault}
            </button>
          )}
          {allowTokenUI && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="px-3 py-1 text-sm text-red-600 border border-red-300 dark:border-red-700 rounded hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
            >
              {t.common.delete}
            </button>
          )}
        </div>
      </div>

      {testResult && (
        <div
          className={`mt-2 text-sm ${testResult.valid ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
        >
          {testResult.valid
            ? t.settings.validToken(testResult.login!)
            : t.settings.invalidToken(testResult.error!)}
        </div>
      )}

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
        {t.settings.added}: {formatTimestamp(token.created_at, locale)}
      </p>
    </div>
  );
}

function AddTokenModal({
  onClose,
  onAdded,
  t,
}: {
  onClose: () => void;
  onAdded: () => void;
  t: ReturnType<typeof useI18n>["t"];
}) {
  const [label, setLabel] = useState("");
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/settings/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, token }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        return;
      }

      setSuccess(t.settings.tokenAdded(data.login));
      onAdded();
      setTimeout(onClose, 1500);
    } catch {
      setError(t.settings.failedToSave);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-semibold mb-4">
          {t.settings.addGithubToken}
        </h3>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="token-label"
              className="block text-sm font-medium mb-1"
            >
              {t.settings.label}
            </label>
            <input
              id="token-label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t.settings.labelPlaceholder}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="mb-4">
            <label
              htmlFor="token-value"
              className="block text-sm font-medium mb-1"
            >
              {t.settings.personalAccessToken}
            </label>
            <input
              id="token-value"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={t.settings.tokenPlaceholder}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t.settings.tokenValidation}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-sm text-green-600 dark:text-green-400">
              {success}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={saving || !label || !token}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? t.settings.validating : t.settings.validateAndSave}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
