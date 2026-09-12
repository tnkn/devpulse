/**
 * .env の PORT だけを process.env に載せてから、引数で渡されたコマンドを起動する。
 *
 * next dev / next start は起動時に process.env.PORT を見るが、Next 自身が .env を
 * 読むのはポートを決めたあとなので、PORT はここで先に読み込む必要がある。
 * node の --env-file は使えない（Next が execArgv を NODE_OPTIONS 経由で子プロセスへ
 * 引き継ぐため、--env-file が NODE_OPTIONS に現れて起動に失敗する）。
 *
 * PORT 以外を持ち込まないのは、@next/env が「既に process.env にある値」を .env* より
 * 優先するため。ここで .env を丸ごと載せると .env.local や .env.development が .env に
 * 負け、${VAR} の展開も行われなくなる。
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

if (existsSync(".env")) {
  // 解析は Node の実装に任せ、PORT 以外は読み込み前の値に戻す。
  // loadEnvFile は既存の値を上書きしないので、シェルの PORT が .env より優先される。
  const before = { ...process.env };
  process.loadEnvFile(".env");

  for (const key of Object.keys(process.env)) {
    if (key === "PORT") continue;
    if (key in before) {
      process.env[key] = before[key];
    } else {
      delete process.env[key];
    }
  }
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
