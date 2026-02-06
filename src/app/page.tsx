import Link from "next/link";
import { getRepositories } from "@/lib/data";
import { RepositorySelector, UpdateButton, DeleteButton } from "@/components/ui";

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
          <div className="flex items-center gap-3">
            <RepositorySelector />
            {repositories.length >= 2 && (
              <Link
                href="/compare"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Compare Repositories
              </Link>
            )}
          </div>
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
              Click &quot;+ Add Repository&quot; to collect data from GitHub.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {repositories.map((repo) => {
              const [owner, repoName] = repo.displayName.includes("/")
                ? repo.displayName.split("/")
                : [repo.name.split("__")[0], repo.name.split("__")[1]];
              return (
                <div
                  key={repo.name}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
                >
                  <Link href={`/${repo.name}`} className="block mb-3">
                    <h3 className="font-semibold mb-1">{repo.displayName}</h3>
                    {repo.lastCollected && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Last collected: {formatTimestamp(repo.lastCollected)}
                      </p>
                    )}
                  </Link>
                  <div className="flex items-center gap-2">
                    <UpdateButton owner={owner} repo={repoName} />
                    <DeleteButton repoKey={repo.name} repoName={repo.displayName} />
                  </div>
                </div>
              );
            })}
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
