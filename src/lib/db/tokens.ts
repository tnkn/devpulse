import { DuckDBInstance } from "@duckdb/node-api";
import type { DuckDBConnection } from "@duckdb/node-api";
import { promises as fs } from "fs";
import path from "path";
import { TOKEN_SCHEMA_DDL } from "./schema";

const DATA_DIR = process.env.DATA_DIR || "./data";
const TOKEN_DB_PATH = path.resolve(DATA_DIR, "tokens.duckdb");

const globalRef = globalThis as unknown as {
  __dev_vis_token_db?: DuckDBInstance;
  __dev_vis_token_db_promise?: Promise<DuckDBInstance>;
};

async function getTokenDb(): Promise<DuckDBInstance> {
  // Already initialized
  if (globalRef.__dev_vis_token_db) {
    return globalRef.__dev_vis_token_db;
  }

  // Initialization in progress (avoid race condition)
  if (globalRef.__dev_vis_token_db_promise) {
    return globalRef.__dev_vis_token_db_promise;
  }

  // Start initialization
  globalRef.__dev_vis_token_db_promise = (async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const instance = await DuckDBInstance.create(TOKEN_DB_PATH);

    const conn = await instance.connect();
    const statements = TOKEN_SCHEMA_DDL.split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const stmt of statements) {
      await conn.run(stmt);
    }
    conn.closeSync();

    globalRef.__dev_vis_token_db = instance;
    return instance;
  })();

  try {
    return await globalRef.__dev_vis_token_db_promise;
  } catch (err) {
    // Clear promise so next call retries
    globalRef.__dev_vis_token_db_promise = undefined;
    throw err;
  }
}

export async function getTokenConnection(): Promise<DuckDBConnection> {
  const instance = await getTokenDb();
  return instance.connect();
}
