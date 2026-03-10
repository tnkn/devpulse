# dev-vis

GitHub リポジトリの開発状況を [DORA メトリクス](https://dora.dev/guides/dora-metrics-four-keys/) に基づいて可視化する Web アプリケーションです。

## DORA メトリクス

| メトリクス | 説明 | データソース |
|---|---|---|
| **Deployment Frequency** | デプロイ頻度（日・週・月別） | マージ済み PR 数 |
| **Lead Time for Changes** | 変更のリードタイム | PR 作成〜マージまでの時間 |
| **Change Failure Rate** | 変更失敗率 | マージ時の CI 失敗率 |
| **Revert Rate** | リバート率 | リバートコミットの割合 |
| **Change Size** | 変更サイズ | PR あたりの変更行数（LOC） |
| **Time to First Review** | 初回レビュー時間 | PR 作成〜最初のレビューまでの時間 |

## 主な機能

- **DORA メトリクスダッシュボード** — 6 種類のチャートと詳細テーブル
- **期間粒度の切り替え** — 日・週・月でチャートを切り替え
- **日付フィルター** — 任意の期間に絞り込み
- **個人別メトリクス** — マージ PR 数（Assignee ベース）・レビュー数を個人別に集計
- **アクティビティ履歴モーダル** — ユーザー名クリックで PR・コミット・レビューの詳細をタブ表示（GitHub リンク付き）
- **多言語対応** — 英語 / 日本語の切り替え
- **複数リポジトリの比較**
- **データエクスポート** — JSON / CSV
- **GitHub トークン管理** — Settings ページから複数トークンの登録・テスト・切り替え

## 計算ロジック

### チームメトリクス（チャート・期間サマリー）

| メトリクス | 計算方法 |
|---|---|
| Deployment Frequency | 期間内のマージ済み PR 数を日・週・月で集計 |
| Lead Time for Changes | PR の `created_at` 〜 `merged_at` の差分（時間） |
| Change Failure Rate | マージ時に CI が失敗した PR の割合 |
| Revert Rate | 期間内コミットのうち "revert" コミットの割合 |
| Change Size | PR あたりの `additions + deletions`（LOC）の平均・σ |
| Time to First Review | PR の `created_at` 〜 最初のレビュー `submitted_at` の差分（時間） |

### 個人別メトリクス

- **PR メトリクス**: マージ済み PR の **Assignees** を基に個人に帰属させる。Assignees が未設定の場合は PR 作成者（`user_login`）にフォールバック。1 つの PR に複数 Assignees がいる場合、各担当者にそれぞれカウントされる。
- **レビューメトリクス**: レビューの `user_login` を基に集計。Bot は除外。

### アクティビティ履歴（モーダル）

ユーザー名クリックで表示されるモーダルには 3 つのタブがある:

- **Merged PRs** — 当該ユーザーが Assignee（またはフォールバックで作成者）のマージ済み PR
- **Commits** — マージコミットの `author.email` から `login → email` のマッピングを構築し、コミットを個人に紐付け
- **Reviews** — 当該ユーザーのレビュー履歴

## セットアップ

### 前提条件

- Node.js 18+
- pnpm

### インストール

```bash
pnpm install
cp .env.sample .env
```

### 環境変数

`.env` ファイルに以下を設定してください。

| 変数名 | 説明 | デフォルト値 |
|---|---|---|
| `DATA_DIR` | データディレクトリパス | `./data` |
| `GITHUB_TOKEN` | GitHub Personal Access Token | — |
| `ALLOW_TOKEN_UI` | UI からのトークン管理を許可 | `true` |
| `ENCRYPTION_KEY` | DB 内トークンの暗号化キー | (自動生成) |

### GitHub Personal Access Token の設定

リポジトリの検索・データ収集に GitHub PAT が必要です。環境変数 `GITHUB_TOKEN` に設定するか、Settings ページから UI で登録できます。

#### Fine-grained PAT（推奨）

[GitHub Settings > Developer settings > Personal access tokens > Fine-grained tokens](https://github.com/settings/personal-access-tokens/new) から作成してください。

対象リポジトリに対して以下の権限を付与してください。

| 権限 | アクセス | 用途 |
|---|---|---|
| **Metadata** | Read | リポジトリ検索・一覧の取得 |
| **Contents** | Read | コミット履歴の取得 |
| **Issues** | Read | Issue 履歴の取得 |
| **Pull requests** | Read | PR 一覧・詳細（変更行数）・レビュー履歴の取得 |
| **Checks** | Read | CI 実行結果の取得（Change Failure Rate の算出に**必須**） |
| **Commit statuses** | Read | CI ステータスの取得（Checks と併用推奨） |

> **注意: Checks 権限がないと Change Failure Rate が常に 0% になります。**
> 権限が不足している場合、CI ステータスの取得はサイレントにスキップされ、
> サーバーログに `Skipping CI status check: Token lacks 'Checks: Read' permission` と出力されます。
> Fine-grained PAT を作成した後からでも、Settings > Developer settings > Fine-grained tokens から権限を追加できます。

#### Classic PAT

`repo` スコープを付与してください。

## 使い方

### 開発サーバー起動

```bash
pnpm dev
```

http://localhost:3000 を開きます。

### データ収集

1. トップページの **「+ Add Repository」** ボタンをクリック
2. リポジトリを検索・選択し **「Collect」** をクリック
3. データ収集が完了したら **「View」** でメトリクスを確認

### データ構造

収集されたデータは `DATA_DIR` 以下にリポジトリごとの DuckDB ファイルとして保存されます。

```
data/
  └── <owner>__<repo>/
      └── repo.duckdb
```

各 DB には `metadata`, `commits`, `pull_requests`, `releases`, `issues` テーブルが含まれます。

既存の JSON ダンプ（`YYYYMMDD_HHMMSS/*.json`）がある場合、初回アクセス時に自動で DuckDB へ移行されます。

#### 差分取得

2回目以降のデータ収集では、DB 内の最新タイムスタンプを基に差分のみを GitHub API から取得します。これにより API コール数を大幅に削減できます。

## 技術スタック

- [Next.js](https://nextjs.org/) (App Router)
- [React](https://react.dev/)
- [Recharts](https://recharts.org/) (グラフ描画)
- [Tailwind CSS](https://tailwindcss.com/)
- [TypeScript](https://www.typescriptlang.org/)
- [DuckDB](https://duckdb.org/) (データ永続化・クエリ、`@duckdb/node-api`)

## Docker

```bash
docker compose up --build
```
