/**
 * Seeds a demo repository so the Issue dependency graph can be explored
 * without collecting a real GitHub repository.
 *
 *   pnpm seed:demo                      # acme/checkout-revamp
 *   pnpm seed:demo --repo my-org/my-app # custom name
 *
 * The demo data covers every status colour, three separate dependency
 * clusters (so filtering by a start point actually narrows the graph)
 * and a few issues with no dependencies at all. Only issues and their
 * dependencies are seeded, so the DORA charts on the repository page
 * stay empty.
 *
 * Runs on Node's built-in TypeScript support (Node 22.18+ / 24), reusing
 * the app's own schema and upsert helpers so it cannot drift from them.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";
import {
  MIGRATION_DDL,
  SCHEMA_DDL,
  splitSqlStatements,
} from "../src/lib/db/schema.ts";
import {
  replaceIssueRelations,
  upsertIssues,
  upsertMetadata,
} from "../src/lib/db/upsert.ts";
import type { Issue } from "../src/types/index.ts";

const DATA_DIR = process.env.DATA_DIR || "./data";

const EPIC_CHECKOUT = "epic: checkout";
const EPIC_PAYMENTS = "epic: payments";
const EPIC_INFRA = "epic: infra";

interface SeedIssue {
  number: number;
  title: string;
  state: "open" | "closed";
  labels: string[];
  assignees?: string[];
}

/** Cluster A: checkout revamp. Cluster B: payments. Cluster C: infra. */
const SEED_ISSUES: SeedIssue[] = [
  // --- Epics: parents of the clusters below (sub-issue hierarchy) ---
  {
    number: 100,
    title: "【Epic】チェックアウト刷新",
    state: "open",
    labels: [EPIC_CHECKOUT, "epic"],
  },
  {
    number: 200,
    title: "【Epic】決済基盤の刷新",
    state: "open",
    labels: [EPIC_PAYMENTS, "epic"],
  },
  {
    number: 300,
    title: "【Epic】開発基盤の整備",
    state: "open",
    labels: [EPIC_INFRA, "epic"],
  },

  // --- Cluster A: checkout ---
  {
    number: 101,
    title: "カート API のスキーマ設計",
    state: "closed",
    labels: [EPIC_CHECKOUT, "backend"],
  },
  {
    number: 102,
    title: "在庫チェックの実装",
    state: "closed",
    labels: [EPIC_CHECKOUT, "backend"],
  },
  {
    number: 103,
    title: "カート状態の永続化 (Redis)",
    state: "closed",
    labels: [EPIC_CHECKOUT, "backend"],
  },
  {
    number: 104,
    title: "チェックアウト画面のワイヤーフレーム",
    state: "closed",
    labels: [EPIC_CHECKOUT, "design"],
  },
  {
    number: 105,
    title: "チェックアウト UI の実装",
    state: "open",
    labels: [EPIC_CHECKOUT, "frontend"],
    assignees: ["alice"],
  },
  {
    number: 106,
    title: "配送先フォームのバリデーション",
    state: "open",
    labels: [EPIC_CHECKOUT, "frontend", "in-progress"],
  },
  {
    number: 107,
    title: "クーポン適用ロジック",
    state: "open",
    labels: [EPIC_CHECKOUT, "backend"],
  },
  {
    number: 108,
    title: "チェックアウトの E2E テスト",
    state: "open",
    labels: [EPIC_CHECKOUT, "qa"],
  },
  {
    number: 109,
    title: "チェックアウト刷新のリリース",
    state: "open",
    labels: [EPIC_CHECKOUT, "release"],
  },

  // --- Cluster B: payments ---
  {
    number: 201,
    title: "決済プロバイダの比較検討",
    state: "closed",
    labels: [EPIC_PAYMENTS, "research"],
  },
  {
    number: 202,
    title: "Stripe 連携の PoC",
    state: "closed",
    labels: [EPIC_PAYMENTS, "backend"],
  },
  {
    number: 203,
    title: "カード情報のトークン化",
    state: "open",
    labels: [EPIC_PAYMENTS, "backend", "security"],
    assignees: ["bob"],
  },
  {
    number: 204,
    title: "3D セキュア 2.0 対応",
    state: "open",
    labels: [EPIC_PAYMENTS, "backend"],
  },
  {
    number: 205,
    title: "返金 API の実装",
    state: "open",
    labels: [EPIC_PAYMENTS, "backend"],
  },
  {
    number: 206,
    title: "決済失敗時のリトライ設計",
    state: "open",
    labels: [EPIC_PAYMENTS, "wip"],
  },
  {
    number: 207,
    title: "決済基盤の負荷試験",
    state: "open",
    labels: [EPIC_PAYMENTS, "qa"],
  },
  {
    number: 208,
    title: "決済基盤のリリース",
    state: "open",
    labels: [EPIC_PAYMENTS, "release"],
  },

  // --- Cluster C: infra ---
  {
    number: 301,
    title: "CI を GitHub Actions へ移行",
    state: "closed",
    labels: [EPIC_INFRA, "ci"],
  },
  {
    number: 302,
    title: "ステージング環境の構築",
    state: "open",
    labels: [EPIC_INFRA, "infra"],
    assignees: ["carol"],
  },
  {
    number: 303,
    title: "監視ダッシュボードの整備",
    state: "open",
    labels: [EPIC_INFRA, "infra"],
  },

  // --- No dependencies: hidden from the graph until linked ---
  {
    number: 401,
    title: "README の更新",
    state: "open",
    labels: ["docs"],
  },
  {
    number: 402,
    title: "依存パッケージの定期更新",
    state: "open",
    labels: ["chore"],
  },
];

/** [blocker, blocked] — the blocker must finish before the blocked issue. */
const SEED_DEPENDENCIES: [number, number][] = [
  // Cluster A
  [101, 102],
  [101, 103],
  [103, 105],
  [104, 105],
  [105, 106],
  [105, 107],
  [102, 108],
  [106, 108],
  [107, 108],
  [108, 109],
  // Cluster B
  [201, 202],
  [202, 203],
  [203, 204],
  [203, 205],
  [203, 206],
  [204, 207],
  [206, 207],
  [207, 208],
  [205, 208],
  // Cluster C
  [301, 302],
  [302, 303],
];

/** [parent, child] — GitHub's sub-issue hierarchy. */
const SEED_SUB_ISSUES: [number, number][] = [
  ...[101, 102, 103, 104, 105, 106, 107, 108, 109].map(
    (child) => [100, child] as [number, number],
  ),
  ...[201, 202, 203, 204, 205, 206, 207, 208].map(
    (child) => [200, child] as [number, number],
  ),
  ...[301, 302, 303].map((child) => [300, child] as [number, number]),
];

function parseRepoArg(): { owner: string; repo: string } {
  const index = process.argv.indexOf("--repo");
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  const fullName = value ?? "acme/checkout-revamp";
  const [owner, repo] = fullName.split("/");
  if (!owner || !repo) {
    throw new Error(`--repo expects "owner/name", got "${fullName}"`);
  }
  return { owner, repo };
}

/** Spreads timestamps over the past few months so dates look plausible. */
function timestampsFor(index: number, state: "open" | "closed") {
  const day = 24 * 60 * 60 * 1000;
  const createdAt = new Date(Date.now() - (120 - index * 4) * day);
  const updatedAt = new Date(Date.now() - (30 - (index % 20)) * day);
  const closedAt =
    state === "closed" ? new Date(updatedAt.getTime() - day) : null;
  return {
    created_at: createdAt.toISOString(),
    updated_at: updatedAt.toISOString(),
    closed_at: closedAt ? closedAt.toISOString() : null,
  };
}

async function main(): Promise<void> {
  const { owner, repo } = parseRepoArg();
  const repoKey = `${owner}__${repo}`;
  const dbPath = path.resolve(DATA_DIR, repoKey, "repo.duckdb");
  await fs.mkdir(path.dirname(dbPath), { recursive: true });

  const instance = await DuckDBInstance.create(dbPath);
  const conn = await instance.connect();

  try {
    // Same schema path the app takes when it opens a repository.
    for (const statement of splitSqlStatements(SCHEMA_DDL)) {
      await conn.run(statement);
    }
    for (const statement of splitSqlStatements(MIGRATION_DDL)) {
      try {
        await conn.run(statement);
      } catch {
        // Already applied — mirrors runMigrations() in src/lib/db/index.ts
      }
    }

    const issues: Issue[] = SEED_ISSUES.map((seed, index) => ({
      number: seed.number,
      // Stand-in for GitHub's global issue id, which the dependencies
      // API needs; the demo repository is never pushed to GitHub.
      id: 900_000_000 + seed.number,
      title: seed.title,
      state: seed.state,
      labels: seed.labels.map((name) => ({ name })),
      assignees: seed.assignees ?? [],
      ...timestampsFor(index, seed.state),
    }));
    await upsertIssues(conn, issues);

    await replaceIssueRelations(
      conn,
      issues.map((i) => i.number),
      SEED_DEPENDENCIES.map(([blocker, blocked]) => ({
        blocker_number: blocker,
        blocked_number: blocked,
      })),
      SEED_SUB_ISSUES.map(([parent, child]) => ({
        parent_number: parent,
        child_number: child,
      })),
    );

    // Assignees and relationships are part of the seed, so mark both as
    // synced — a collection would otherwise wipe them by asking GitHub,
    // which knows nothing about this demo repository.
    const now = new Date().toISOString();
    await upsertMetadata(
      conn,
      `${owner}/${repo}`,
      `https://github.com/${owner}/${repo}`,
      null,
      now,
      now,
    );

    await conn.run("FORCE CHECKPOINT");

    console.log(`\n✓ デモデータを作成しました: ${dbPath}`);
    console.log(
      `  Issue: ${issues.length} 件 / 依存関係: ${SEED_DEPENDENCIES.length} 件 / 親子関係: ${SEED_SUB_ISSUES.length} 件`,
    );
    console.log(
      `  ラベル: ${EPIC_CHECKOUT} / ${EPIC_PAYMENTS} / ${EPIC_INFRA}`,
    );
    console.log("\n  pnpm dev のあと以下を開いてください:");
    console.log(`  http://localhost:3000/${repoKey}/dependencies\n`);
  } finally {
    conn.closeSync();
    instance.closeSync();
  }
}

await main();
