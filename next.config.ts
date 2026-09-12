import type { NextConfig } from "next";

// LAN 上の別マシンから開発サーバーを開くときに許可するホスト。
// Next は Origin / Referer から取り出したホスト名だけを照合するため、
// スキームやポートを含めた値は一致しない。
// マシン固有の値なのでコードに直書きせず .env から受け取る（カンマ区切り）。
const allowedDevOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  output: "standalone",
  // dev 起動のたびに AGENTS.md / CLAUDE.md を生成させない。
  agentRules: false,
  serverExternalPackages: ["@duckdb/node-api"],
  ...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
  experimental: {
    // TypeScript 7 ships the native compiler and no longer exposes the
    // JS compiler API `next build` type-checks with. Spawn the `tsc` CLI
    // instead; drop this once Next.js supports TypeScript 7 natively.
    useTypeScriptCli: true,
  },
};

export default nextConfig;
