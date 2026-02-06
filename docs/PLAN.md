# dev-vis 開発計画

## 概要

GitHubリポジトリごとの開発状況をDORAメトリクスに基づいて可視化するシングルコンテナアプリケーション。

## 技術スタック

- **フレームワーク**: Next.js (App Router)
- **パッケージマネージャー**: pnpm
- **環境構築**: mise
- **データ永続化**: DuckDB（リポジトリごとに独立した DB ファイル）
- **コンテナ**: Docker

## DORAメトリクス

以下の4つの主要メトリクスを可視化:

| メトリクス | 説明 | データソース |
|-----------|------|-------------|
| **Deployment Frequency** | デプロイ頻度 | タグ/リリース履歴 |
| **Lead Time for Changes** | 変更のリードタイム | コミット〜マージまでの時間 |
| **Change Failure Rate** | 変更失敗率 | revert コミット、hotfix ブランチ |
| **Time to Restore Service (MTTR)** | 復旧時間 | Issue（bug/incident）のクローズ時間 |

## データ構造

リポジトリごとに独立した DuckDB ファイルで管理:

```
/data
  └── <owner>__<repo>/
      └── repo.duckdb          # DuckDB データベース
```

### テーブル構成

| テーブル | 主キー | 説明 |
|----------|--------|------|
| `metadata` | `full_name` | リポジトリメタデータ（1行） |
| `commits` | `sha` | コミット履歴 |
| `pull_requests` | `number` | PR 履歴（labels は JSON 文字列で保存） |
| `releases` | `id` | リリース履歴 |
| `issues` | `number` | Issue 履歴（labels は JSON 文字列で保存） |

### 差分取得

2回目以降のデータ収集では差分のみ取得し、`INSERT OR REPLACE` で upsert:

- **commits**: `since` パラメータ（最新 `author_date` 以降）
- **issues**: `since` パラメータ（最新 `updated_at` 以降）
- **pull_requests**: `sort=updated&direction=desc` + 最新 `updated_at` で打ち切り
- **releases**: 件数が少ないため毎回全件取得

## 機能一覧

### Phase 1: 基盤構築

- [x] プロジェクト初期化（Next.js + pnpm + mise）
- [x] Dockerfile作成
- [x] 基本レイアウト・ナビゲーション
- [x] データディレクトリ読み込みAPI

### Phase 2: データ表示

- [x] リポジトリ一覧ページ
- [x] ダンプデータ選択機能
- [x] 基本的なメトリクス計算ロジック

### Phase 3: DORA メトリクス可視化

- [x] Deployment Frequency グラフ
- [x] Lead Time for Changes グラフ
- [x] Change Failure Rate グラフ
- [x] MTTR グラフ
- [x] ダッシュボード（全メトリクス概要）

### Phase 4: 拡張機能

- [x] 期間フィルター
- [x] リポジトリ比較機能
- [x] データエクスポート（CSV/JSON）

### Phase 5: DuckDB 移行 + 差分取得

- [x] DuckDB によるデータ永続化（`@duckdb/node-api`）
- [x] リポジトリごとの独立 DB ファイル
- [x] 差分フェッチ（`since` パラメータ / `updated_at` 打ち切り）
- [x] `INSERT OR REPLACE` による upsert
- [x] 既存 JSON ダンプからの自動マイグレーション

## ディレクトリ構成

```
dev-vis/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # ホーム（リポジトリ一覧）
│   │   ├── layout.tsx
│   │   ├── [repo]/
│   │   │   └── [dump]/
│   │   │       └── page.tsx    # メトリクスダッシュボード
│   │   └── api/
│   │       ├── repositories/   # リポジトリ一覧API
│   │       └── metrics/        # メトリクス計算API
│   ├── components/
│   │   ├── charts/             # グラフコンポーネント
│   │   └── ui/                 # 共通UIコンポーネント
│   ├── lib/
│   │   ├── db/                 # DuckDB インスタンス管理・スキーマ・upsert・マイグレーション
│   │   ├── data/               # データ読み込みロジック（DuckDB クエリ）
│   │   ├── github/             # GitHub API クライアント・データ収集
│   │   └── metrics/            # メトリクス計算ロジック
│   └── types/                  # 型定義
├── public/
├── data/                       # マウントポイント（永続化領域）
├── Dockerfile
├── docker-compose.yml
├── mise.toml
├── package.json
└── PLAN.md
```

## 環境変数

| 変数名 | 説明 | デフォルト値 |
|--------|------|-------------|
| `DATA_DIR` | データディレクトリパス | `/data` |
| `PORT` | アプリケーションポート | `3000` |

## 開発開始コマンド

```bash
# 環境セットアップ
mise install

# 依存関係インストール
pnpm install

# 開発サーバー起動
pnpm dev

# Docker ビルド＆起動
docker compose up --build
```

## 次のステップ

- パフォーマンス最適化（大規模リポジトリでのクエリチューニング）
- DB バックアップ / リストア機能
- Webhook による自動データ収集
