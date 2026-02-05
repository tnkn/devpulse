import Link from "next/link";
import { getRepositories } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const repositories = await getRepositories();

  return (
    <main className="min-h-screen p-8">
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">dev-vis</h1>
            <p className="text-gray-600 dark:text-gray-400">
              GitHub Repository DORA Metrics Visualization
            </p>
          </div>
          {repositories.length >= 2 && (
            <Link
              href="/compare"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Compare Repositories
            </Link>
          )}
        </div>
      </header>

      <section>
        <h2 className="text-xl font-semibold mb-4">Repositories</h2>

        {repositories.length === 0 ? (
          <div className="border border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              No repositories found.
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Place dump data in <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">/data/&lt;repository_name&gt;/&lt;YYYYMMDD_HHMMSS&gt;/</code>
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {repositories.map((repo) => (
              <div
                key={repo.name}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
              >
                <h3 className="font-semibold mb-2">{repo.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  {repo.dumps.length} dump(s) available
                </p>
                <div className="space-y-1">
                  {repo.dumps.slice(0, 3).map((dump) => (
                    <Link
                      key={dump.id}
                      href={`/${repo.name}/${dump.id}`}
                      className="block text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {formatTimestamp(dump.timestamp)}
                    </Link>
                  ))}
                  {repo.dumps.length > 3 && (
                    <p className="text-xs text-gray-400">
                      +{repo.dumps.length - 3} more
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}
