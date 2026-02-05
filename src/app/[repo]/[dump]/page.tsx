import Link from "next/link";
import { notFound } from "next/navigation";
import { getDumpData, getDumps } from "@/lib/data";
import { calculateDORAMetrics, calculateSummary } from "@/lib/metrics";
import { MetricsDashboard } from "@/components/MetricsDashboard";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{
    repo: string;
    dump: string;
  }>;
}

export default async function MetricsDashboardPage({ params }: PageProps) {
  const { repo, dump } = await params;
  const decodedRepo = decodeURIComponent(repo);

  const data = await getDumpData(decodedRepo, dump);

  if (!data.metadata) {
    notFound();
  }

  const metrics = calculateDORAMetrics(
    data.commits,
    data.pulls,
    data.releases,
    data.issues
  );
  const summary = calculateSummary(metrics);
  const dumps = await getDumps(decodedRepo);

  return (
    <main className="min-h-screen p-8">
      <header className="mb-8">
        <nav className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          <Link href="/" className="hover:underline">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span>{decodedRepo}</span>
          <span className="mx-2">/</span>
          <span>{dump}</span>
        </nav>
        <h1 className="text-3xl font-bold mb-2">{decodedRepo}</h1>
        <div className="flex items-center gap-4">
          <select
            className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-3 py-1 text-sm"
            defaultValue={dump}
          >
            {dumps.map((d) => (
              <option key={d.id} value={d.id}>
                {formatTimestamp(d.timestamp)}
              </option>
            ))}
          </select>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Dumped: {formatTimestamp(data.metadata.dumped_at)}
          </p>
        </div>
      </header>

      {/* Summary Cards */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">DORA Metrics Summary</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            title="Deployment Frequency"
            value={summary.total_deployments.toString()}
            unit="deployments"
            description="Total releases"
          />
          <SummaryCard
            title="Lead Time"
            value={summary.avg_lead_time_hours.toString()}
            unit="hours"
            description="Average PR merge time"
          />
          <SummaryCard
            title="Change Failure Rate"
            value={`${summary.avg_failure_rate}%`}
            unit=""
            description="Average failure rate"
          />
          <SummaryCard
            title="MTTR"
            value={summary.avg_restore_time_hours.toString()}
            unit="hours"
            description="Average time to restore"
          />
        </div>
      </section>

      {/* Data Overview */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Data Overview</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <DataCard title="Commits" count={data.commits.length} />
          <DataCard title="Pull Requests" count={data.pulls.length} />
          <DataCard title="Releases" count={data.releases.length} />
          <DataCard title="Issues" count={data.issues.length} />
        </div>
      </section>

      {/* Interactive Dashboard */}
      <MetricsDashboard metrics={metrics} repoName={decodedRepo} dumpId={dump} />
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
        {unit && <span className="text-sm font-normal text-gray-500 ml-1">{unit}</span>}
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
