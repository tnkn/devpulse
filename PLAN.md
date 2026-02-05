# dev-vis 開発計画

## 概要

GitHubリポジトリごとの開発状況をDORAメトリクスに基づいて可視化するシングルコンテナアプリケーション。

## 技術スタック

- **フレームワーク**: Next.js (App Router)
- **パッケージマネージャー**: pnpm
- **環境構築**: mise
- **データ永続化**: ファイルベース（コンテナ内ディレクトリ）
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

```
/data
  └── <repository_name>/
      └── <YYYYMMDD_HHMMSS>/
          ├── commits.json      # コミット履歴
          ├── pulls.json        # PR履歴
          ├── releases.json     # リリース/タグ履歴
          ├── issues.json       # Issue履歴
          └── metadata.json     # ダンプ情報（日時、リポジトリURL等）
```

## 機能一覧

### Phase 1: 基盤構築

- [ ] プロジェクト初期化（Next.js + pnpm + mise）
- [ ] Dockerfile作成
- [ ] 基本レイアウト・ナビゲーション
- [ ] データディレクトリ読み込みAPI

### Phase 2: データ表示

- [ ] リポジトリ一覧ページ
- [ ] ダンプデータ選択機能
- [ ] 基本的なメトリクス計算ロジック

### Phase 3: DORA メトリクス可視化

- [ ] Deployment Frequency グラフ
- [ ] Lead Time for Changes グラフ
- [ ] Change Failure Rate グラフ
- [ ] MTTR グラフ
- [ ] ダッシュボード（全メトリクス概要）

### Phase 4: 拡張機能

- [ ] 期間フィルター
- [ ] リポジトリ比較機能
- [ ] データエクスポート（CSV/JSON）

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
│   │   ├── data/               # データ読み込みロジック
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

1. mise.toml でNode.js環境を定義
2. `pnpm create next-app` でプロジェクト初期化
3. 基本的なディレクトリ構造を作成
4. Dockerfile / docker-compose.yml を作成
