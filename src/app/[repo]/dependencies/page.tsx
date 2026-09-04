import Link from "next/link";
import { notFound } from "next/navigation";
import { DependencyGraph } from "@/components/DependencyGraph";
import { LocaleToggle, UpdateButton } from "@/components/ui";
import { getIssueRelations, getRepoData } from "@/lib/data";
import { parseDependencyFilters } from "@/lib/dependencies/filter-params";
import { getMessages } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{
    repo: string;
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DependencyGraphPage({
  params,
  searchParams,
}: PageProps) {
  const { repo } = await params;
  const decodedRepo = decodeURIComponent(repo);

  // Sequential on purpose: getDb() only populates its instance cache after
  // awaiting openInstance(), so two concurrent getConnection() calls for the
  // same repo would open two independent DuckDB instances on one file.
  const data = await getRepoData(decodedRepo);
  const relations = await getIssueRelations(decodedRepo);

  if (!data.metadata) {
    notFound();
  }

  const t = await getMessages();

  // Parsed here rather than in the browser: the component renders on the
  // server first, so reading the URL client-side would start with no
  // filters and hydrate into a different tree than was sent.
  const filters = parseDependencyFilters(await searchParams, {
    labels: new Set(data.issues.flatMap((i) => i.labels.map((l) => l.name))),
    issueNumbers: new Set(data.issues.map((i) => i.number)),
  });

  return (
    // Fixed to the viewport rather than growing with content: the graph is
    // the page, so it should take whatever height the window has.
    <main className="flex h-screen flex-col gap-4 overflow-hidden p-6">
      <header className="shrink-0">
        <nav className="text-sm text-gray-500 dark:text-gray-400 mb-2">
          <Link href="/" className="hover:underline">
            {t.common.home}
          </Link>
          <span className="mx-2">/</span>
          <Link href={`/${repo}`} className="hover:underline">
            {data.metadata.repository}
          </Link>
          <span className="mx-2">/</span>
          <span>{t.dependencies.title}</span>
        </nav>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">{t.dependencies.title}</h1>
          <div className="flex items-center gap-2">
            {/* Re-collecting is what refreshes the relationships this page
                draws, so it belongs here and not only on the repo page. */}
            <UpdateButton
              owner={data.metadata.repository.split("/")[0]}
              repo={data.metadata.repository.split("/")[1]}
              tokenId={data.metadata.token_id}
            />
            <LocaleToggle />
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {t.dependencies.description}
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <DependencyGraph
          repoKey={decodedRepo}
          repoFullName={data.metadata.repository}
          issues={data.issues}
          initialEdges={relations.dependencies}
          subIssues={relations.subIssues}
          projectFields={relations.projectFields}
          projectFieldsSyncedAt={relations.projectFieldsSyncedAt}
          projectFieldsError={relations.projectFieldsError}
          initialFilters={filters}
        />
      </div>
    </main>
  );
}
