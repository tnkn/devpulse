/**
 * .env を process.env に読み込んでから、引数で渡されたコマンドを起動する。
 *
 * next dev / next start は起動時に process.env.PORT を見るが、Next 自身が .env を
 * 読むのはポートを決めたあとなので、.env の PORT はここで先に読み込む必要がある。
 * node の --env-file は使えない（Next が execArgv を NODE_OPTIONS 経由で子プロセスへ
 * 引き継ぐため、--env-file が NODE_OPTIONS に現れて起動に失敗する）。
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error("usage: node scripts/with-env.mjs <command> [args...]");
  process.exit(1);
}

const child = spawn(command, args, { stdio: "inherit" });

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error(`failed to start ${command}: ${error.message}`);
  process.exit(1);
});
