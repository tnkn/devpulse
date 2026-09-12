import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@duckdb/node-api"],
  experimental: {
    // TypeScript 7 ships the native compiler and no longer exposes the
    // JS compiler API `next build` type-checks with. Spawn the `tsc` CLI
    // instead; drop this once Next.js supports TypeScript 7 natively.
    useTypeScriptCli: true,
  },
};

export default nextConfig;
