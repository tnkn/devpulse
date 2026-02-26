import { getRepositories, getRepoData } from "@/lib/data";
import { calculateDORAMetrics, calculateSummary } from "@/lib/metrics";
import { getMessages } from "@/lib/i18n/server";
import { ComparisonView } from "./ComparisonView";

export const dynamic = "force-dynamic";

interface SearchParams {
  repos?: string;
}

interface PageProps {
  searchParams: Promise<SearchParams>;
}

export default async function ComparePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const repositories = await getRepositories();
  const selectedRepos = params.repos?.split(",") || [];
  const t = await getMessages();

  // Load metrics for selected repositories
  const repoMetrics = await Promise.all(
    selectedRepos.map(async (repoName) => {
      const repo = repositories.find((r) => r.name === repoName);
      if (!repo) return null;

      const data = await getRepoData(repoName);
      if (!data.metadata) return null;

      const metrics = calculateDORAMetrics(
        data.pulls,
        data.commits,
        data.reviews
      );
      const summary = calculateSummary(metrics);

      return {
        repoName,
        displayName: repo.displayName,
        metrics,
        summary,
      };
    })
  );

  const validMetrics = repoMetrics.filter(Boolean) as NonNullable<
    (typeof repoMetrics)[number]
  >[];

  return (
    <main className="min-h-screen p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{t.compare.title}</h1>
        <p className="text-gray-600 dark:text-gray-400">
          {t.compare.subtitle}
        </p>
      </header>

      <ComparisonView
        repositories={repositories}
        selectedMetrics={validMetrics}
        initialSelected={selectedRepos}
      />
    </main>
  );
}
