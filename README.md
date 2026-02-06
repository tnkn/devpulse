# dev-vis

GitHub リポジトリの開発状況を [DORA メトリクス](https://dora.dev/guides/dora-metrics-four-keys/) に基づいて可視化する Web アプリケーションです。

## DORA メトリクス

| メトリクス | 説明 | データソース |
|---|---|---|
| **Deployment Frequency** | デプロイ頻度（月別） | マージ済み PR 数 |
| **Lead Time for Changes** | 変更のリードタイム | PR 作成〜マージまでの時間 |
| **Change Failure Rate** | 変更失敗率 | マージ時の CI 失敗率 |
| **Time to Restore (MTTR)** | 復旧時間 | Issue のオープン〜クローズまでの時間 |

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
| `PORT` | アプリケーションポート | `3000` |
| `GITHUB_TOKEN` | GitHub Personal Access Token | (必須) |

### GitHub Personal Access Token の設定

リポジトリの検索・データ収集に GitHub PAT が必要です。

#### Fine-grained PAT（推奨）

[GitHub Settings > Developer settings > Personal access tokens > Fine-grained tokens](https://github.com/settings/personal-access-tokens/new) から作成してください。

対象リポジトリに対して以下の権限を付与してください。

| 権限 | アクセス | 用途 |
|---|---|---|
| **Contents** | Read | コミット履歴の取得 |
| **Issues** | Read | Issue 履歴の取得 |
| **Pull requests** | Read | PR 履歴の取得 |
| **Checks** | Read | CI 結果の取得（Change Failure Rate） |
| **Commit statuses** | Read | CI ステータスの取得（Change Failure Rate） |

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

### 主な機能

- リポジトリごとの DORA メトリクスダッシュボード
- 期間フィルター
- 複数リポジトリの比較
- データエクスポート（JSON / CSV）

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
