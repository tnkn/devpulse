# devpulse

GitHub リポジトリの開発状況を [DORA メトリクス](https://dora.dev/guides/dora-metrics-four-keys/) に基づいて可視化する Web アプリケーション。Issue 間の依存関係グラフ表示にも対応しています。

## Features

- **DORA メトリクスダッシュボード** — Deployment Frequency / Lead Time for Changes / Change Failure Rate / Revert Rate / Change Size / Time to First Review
- **期間切り替え・日付フィルター・複数リポジトリの比較**
- **個人別メトリクス** — マージ PR 数・レビュー数の集計とアクティビティ履歴（PR・コミット・レビュー）
- **Issue 依存関係グラフ** — [React Flow](https://reactflow.dev/) + dagre によるインタラクティブな可視化。GitHub の依存関係 API と双方向に同期し、グラフ／テーブルの両表示に対応
- **GitHub Projects v2 連携** — Priority / Size をカード・テーブルに表示し、テーブルから編集可能
- **データエクスポート** — JSON / CSV
- **多言語対応** — 英語 / 日本語
- **GitHub トークン管理** — Settings ページから複数トークンの登録・テスト・切り替え

| メトリクス | データソース |
|---|---|
| Deployment Frequency | マージ済み PR 数 |
| Lead Time for Changes | PR 作成〜マージまでの時間 |
| Change Failure Rate | マージ時の CI 失敗率 |
| Revert Rate | リバートコミットの割合 |
| Change Size | PR あたりの変更行数（LOC） |
| Time to First Review | PR 作成〜最初のレビューまでの時間 |

## Requirements

- [mise](https://mise.jdx.dev/)（[activate 済み](https://mise.jdx.dev/getting-started.html)であること。未 activate の場合は以降の `pnpm` を `mise exec -- pnpm` に読み替えてください）

Node.js と pnpm のバージョンは `mise.toml` で管理しています。

## Setup

```bash
mise trust   # 初回のみ。mise.toml を信頼する
mise install
pnpm install
cp .env.sample .env
pnpm dev
```

http://localhost:3000 を開きます。ポートを変えるには `.env` の `PORT` を設定してください。

## Configuration

`.env` に設定する主な変数:

| 変数名 | 説明 | デフォルト |
|---|---|---|
| `DATA_DIR` | データディレクトリパス | `./data` |
| `PORT` | 待ち受けポート（docker compose ではホスト側ポート） | `3000` |
| `ALLOWED_DEV_ORIGINS` | 開発サーバーへのアクセスを許可するホスト名 / IP。スキームとポートは付けない（カンマ区切り） | — |
| `GITHUB_TOKEN` | GitHub Personal Access Token | — |
| `ALLOW_TOKEN_UI` | UI からのトークン管理を許可 | `true` |
| `ENCRYPTION_KEY` | DB 内トークンの暗号化キー | (自動生成) |
| `GITHUB_API_URL` | GitHub Enterprise Server 用ベース URL | `https://api.github.com` |

### GitHub Personal Access Token

`GITHUB_TOKEN` に設定するか、Settings ページの UI から登録できます。Fine-grained PAT の場合、対象リポジトリに以下の権限が必要です。

| 権限 | アクセス | 用途 |
|---|---|---|
| Metadata | Read | リポジトリ検索・一覧取得 |
| Contents | Read | コミット履歴取得 |
| Issues | Read（write で依存関係の追加・削除も可） | Issue・依存関係・サブイシュー取得 |
| Projects | Read（write でテーブル編集も可） | Priority / Size 取得（組織レベル、無くても収集は成功） |
| Pull requests | Read | PR・レビュー履歴取得 |
| Checks / Commit statuses | Read | CI 結果取得（**Change Failure Rate の算出に必須**） |

Classic PAT の場合は `repo` スコープ（Projects も使う場合は `read:project` を追加）で代用できます。

## Usage

1. トップページの **「+ Add Repository」** でリポジトリを追加
2. **「Collect」** をクリックしてデータ収集
3. **「View」** でメトリクスを確認

データは `DATA_DIR/<owner>__<repo>/repo.duckdb` に保存され、2 回目以降は差分のみを GitHub API から取得します。

### デモデータで試す

```bash
pnpm seed:demo
pnpm dev  # http://localhost:3000/acme__checkout-revamp/dependencies (PORT 未設定時)
```

GitHub と同期せず、Issue 依存関係グラフの動作を確認できます（DORA メトリクスは空のままです）。

## Tech Stack

- [Next.js](https://nextjs.org/) (App Router) / [React](https://react.dev/) / [TypeScript](https://www.typescriptlang.org/)
- [Recharts](https://recharts.org/)（チャート描画）
- [React Flow](https://reactflow.dev/) + [dagre](https://github.com/dagrejs/dagre)（依存関係グラフ）
- [Tailwind CSS](https://tailwindcss.com/)
- [DuckDB](https://duckdb.org/)（データ永続化、`@duckdb/node-api`）

## Docker

```bash
docker compose up --build
```
