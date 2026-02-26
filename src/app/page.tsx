import Link from "next/link";
import { getRepositories } from "@/lib/data";
import { getLocale, getMessages } from "@/lib/i18n/server";
import { formatTimestamp } from "@/lib/i18n/format";
import { RepositorySelector, DeleteButton, LocaleToggle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const repositories = await getRepositories();
  const locale = await getLocale();
  const t = await getMessages();

  return (
    <main className="min-h-screen p-8">
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">dev-vis</h1>
            <p className="text-gray-600 dark:text-gray-400">
              {t.home.subtitle}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <LocaleToggle />
            <RepositorySelector />
            {repositories.length >= 2 && (
              <Link
                href="/compare"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {t.home.compareRepositories}
              </Link>
            )}
            <Link
              href="/settings"
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              {t.common.settings}
            </Link>
          </div>
        </div>
      </header>

      <section>
        <h2 className="text-xl font-semibold mb-4">{t.home.repositories}</h2>

        {repositories.length === 0 ? (
          <div className="border border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {t.home.noReposFound}
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              {t.home.addRepoHint}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {repositories.map((repo) => (
              <div
                key={repo.name}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-blue-400 dark:hover:border-blue-500 transition-colors flex items-center justify-between"
              >
                <Link href={`/${repo.name}`} className="block min-w-0 flex-1">
                  <h3 className="font-semibold mb-1">{repo.displayName}</h3>
                  {repo.lastCollected && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t.common.lastCollected}: {formatTimestamp(repo.lastCollected, locale)}
                    </p>
                  )}
                </Link>
                <div className="ml-3 shrink-0">
                  <DeleteButton repoKey={repo.name} repoName={repo.displayName} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
