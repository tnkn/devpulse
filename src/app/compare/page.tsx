import { getRepositories, getDumpData } from "@/lib/data";
import { calculateDORAMetrics, calculateSummary } from "@/lib/metrics";
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

  // Load metrics for selected repositories
  const repoMetrics = await Promise.all(
    selectedRepos.map(async (repoParam) => {
      const [repoName, dumpId] = repoParam.split(":");
      const repo = repositories.find((r) => r.name === repoName);
      if (!repo) return null;

      const dump = dumpId
        ? repo.dumps.find((d) => d.id === dumpId)
        : repo.dumps[0];
      if (!dump) return null;

      const data = await getDumpData(repoName, dump.id);
      if (!data.metadata) return null;

      const metrics = calculateDORAMetrics(
        data.commits,
        data.pulls,
        data.releases,
        data.issues
      );
      const summary = calculateSummary(metrics);

      return {
        repoName,
        dumpId: dump.id,
        dumpTimestamp: dump.timestamp,
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
        <h1 className="text-3xl font-bold mb-2">Repository Comparison</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Compare DORA metrics across multiple repositories
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
