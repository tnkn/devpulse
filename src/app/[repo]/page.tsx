import Link from "next/link";
import { notFound } from "next/navigation";
import { MetricsDashboard } from "@/components/MetricsDashboard";
import { DeleteButton, LocaleToggle, UpdateButton } from "@/components/ui";
import { getRepoData } from "@/lib/data";
import { formatTimestamp } from "@/lib/i18n/format";
import { getLocale, getMessages } from "@/lib/i18n/server";
import {
  calculateAllPeriodMetrics,
  calculateDORAMetrics,
  calculateSummary,
} from "@/lib/metrics";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{
    repo: string;
  }>;
}

export default async function MetricsDashboardPage({ params }: PageProps) {
  const { repo } = await params;
  const decodedRepo = decodeURIComponent(repo);

  const data = await getRepoData(decodedRepo);

  if (!data.metadata) {
    notFound();
  }

  const metrics = calculateDORAMetrics(data.pulls, data.commits, data.reviews);
  const allPeriodMetrics = calculateAllPeriodMetrics(
    data.pulls,
    data.commits,
    data.reviews,
  );
  const summary = calculateSummary(metrics);
  const locale = await getLocale();
  const t = await getMessages();

  return (
    <main className="min-h-screen p-8">
      <header className="mb-8">
        <nav className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          <Link href="/" className="hover:underline">
            {t.common.home}
          </Link>
          <span className="mx-2">/</span>
          <span>{data.metadata.repository}</span>
        </nav>
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">{data.metadata.repository}</h1>
          <div className="flex items-center gap-2">
            <LocaleToggle />
            <UpdateButton
              owner={data.metadata.repository.split("/")[0]}
              repo={data.metadata.repository.split("/")[1]}
              tokenId={data.metadata.token_id}
            />
            <DeleteButton
              repoKey={decodedRepo}
              repoName={data.metadata.repository}
            />
          </div>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          {t.common.lastCollected}:{" "}
          {formatTimestamp(data.metadata.dumped_at, locale)}
        </p>
      </header>

      {/* Summary Cards */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">{t.repo.doraSummary}</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <SummaryCard
            title={t.repo.deploymentFrequency}
            value={summary.total_deployments.toString()}
            unit={t.repo.merges}
            description={t.repo.totalPrMerges}
          />
          <SummaryCard
            title={t.repo.leadTimeForChanges}
            value={summary.avg_lead_time_hours.toString()}
            unit={t.repo.hours}
            description={t.repo.avgPrMergeTime}
          />
          <SummaryCard
            title={t.repo.changeFailureRate}
            value={`${summary.avg_failure_rate}%`}
            unit=""
            description={t.repo.avgFailureRate}
          />
          <SummaryCard
            title={t.repo.revertRate}
            value={`${summary.avg_revert_rate}%`}
            unit=""
            description={t.repo.avgRevertRate}
          />
          <SummaryCard
            title={t.repo.changeSize}
            value={summary.avg_pr_size.toString()}
            unit={t.repo.loc}
            description={t.repo.avgLinesChanged}
          />
          <SummaryCard
            title={t.repo.timeToFirstReview}
            value={summary.avg_pickup_time_hours.toString()}
            unit={t.repo.hours}
            description={t.repo.avgTimeToFirstReview}
          />
        </div>
      </section>

      {/* Data Overview */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">{t.repo.dataOverview}</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <DataCard title={t.repo.commits} count={data.commits.length} />
          <DataCard title={t.repo.pullRequests} count={data.pulls.length} />
          <DataCard title={t.repo.releases} count={data.releases.length} />
          <DataCard title={t.repo.issues} count={data.issues.length} />
        </div>
      </section>

      <hr className="border-gray-200 dark:border-gray-700 mb-8" />

      {/* Interactive Dashboard */}
      <MetricsDashboard
        metrics={metrics}
        allPeriodMetrics={allPeriodMetrics}
        repoName={decodedRepo}
        repoFullName={data.metadata.repository}
        pulls={data.pulls}
        reviews={data.reviews}
        commits={data.commits}
      />
    </main>
  );
}

function SummaryCard({
  title,
  value,
  unit,
  description,
}: {
  title: string;
  value: string;
  unit: string;
  description: string;
}) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <h3 className="text-sm text-gray-500 dark:text-gray-400 mb-1">{title}</h3>
      <p className="text-2xl font-bold">
        {value}
        {unit && (
          <span className="text-sm font-normal text-gray-500 ml-1">{unit}</span>
        )}
      </p>
      <p className="text-xs text-gray-400 mt-1">{description}</p>
    </div>
  );
}

function DataCard({ title, count }: { title: string; count: number }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
      <h3 className="text-sm text-gray-500 dark:text-gray-400">{title}</h3>
      <p className="text-xl font-semibold">{count.toLocaleString()}</p>
    </div>
  );
}
