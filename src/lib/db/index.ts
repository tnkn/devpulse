import { DuckDBInstance } from "@duckdb/node-api";
import type { DuckDBConnection } from "@duckdb/node-api";
import { promises as fs } from "fs";
import path from "path";
import { SCHEMA_DDL } from "./schema";
import { migrateJsonToDb } from "./migrate-json";

const DATA_DIR = process.env.DATA_DIR || "./data";

interface DbEntry {
  instance: DuckDBInstance;
  lastAccess: number;
}

const globalCache = globalThis as unknown as {
  __dev_vis_db_cache?: Map<string, DbEntry>;
  __dev_vis_shutdown_registered?: boolean;
};
if (!globalCache.__dev_vis_db_cache) {
  globalCache.__dev_vis_db_cache = new Map();
}
const cache = globalCache.__dev_vis_db_cache;

// -----------------------------------------------------------
// SIGTERM handler: Docker sends SIGTERM → 10s → SIGKILL.
// Close all cached DB instances so checkpoint_on_shutdown runs
// and WAL is flushed to the main .db file.
// -----------------------------------------------------------
if (!globalCache.__dev_vis_shutdown_registered) {
  globalCache.__dev_vis_shutdown_registered = true;
  process.on("SIGTERM", () => {
    console.log("[db] SIGTERM received, closing all DB instances...");
    for (const [key, entry] of cache) {
      try {
        entry.instance.closeSync();
        console.log(`[db] Closed ${key}`);
      } catch (err) {
        console.error(`[db] Error closing ${key}:`, err);
      }
    }
    cache.clear();
    process.exit(0);
  });
}

function dbPath(repoKey: string): string {
  return path.resolve(DATA_DIR, repoKey, "repo.duckdb");
}

function walPath(repoKey: string): string {
  return dbPath(repoKey) + ".wal";
}

async function initSchema(conn: DuckDBConnection): Promise<void> {
  const statements = SCHEMA_DDL.split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const stmt of statements) {
    await conn.run(stmt);
  }
}

/**
 * Open a DuckDB instance with WAL recovery handling.
 *
 * If DuckDBInstance.create() fails (e.g. corrupt WAL), retry with:
 *   1. Delete .wal file → retry (loses uncommitted data since last checkpoint)
 *   2. Delete .duckdb + .wal → re-create & re-migrate from JSON (full rebuild)
 */
async function openInstance(repoKey: string): Promise<{ instance: DuckDBInstance; isNew: boolean }> {
  const filePath = dbPath(repoKey);
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  const isNew = !await fileExists(filePath);

  // First attempt: normal open (includes WAL replay)
  try {
    const instance = await DuckDBInstance.create(filePath);
    return { instance, isNew };
  } catch (err) {
    if (isNew) throw err; // No recovery possible for a brand-new DB
    console.error(`[db] Failed to open ${repoKey}:`, err);
  }

  // Second attempt: delete corrupt WAL, reopen
  const wal = walPath(repoKey);
  if (await fileExists(wal)) {
    console.warn(`[db] Deleting corrupt WAL for ${repoKey} and retrying...`);
    await fs.unlink(wal);
    try {
      const instance = await DuckDBInstance.create(filePath);
      console.warn(`[db] Recovered ${repoKey} after WAL deletion (data since last checkpoint may be lost)`);
      return { instance, isNew: false };
    } catch (err2) {
      console.error(`[db] Still failed after WAL deletion for ${repoKey}:`, err2);
    }
  }

  // Third attempt: delete everything, rebuild from JSON
  console.warn(`[db] Deleting corrupt DB for ${repoKey} and rebuilding from JSON...`);
  await fs.unlink(filePath).catch(() => {});
  await fs.unlink(wal).catch(() => {});
  const instance = await DuckDBInstance.create(filePath);
  return { instance, isNew: true }; // isNew=true triggers JSON migration
}

export async function getDb(repoKey: string): Promise<DuckDBInstance> {
  const existing = cache.get(repoKey);
  if (existing) {
    existing.lastAccess = Date.now();
    return existing.instance;
  }

  const { instance, isNew } = await openInstance(repoKey);

  // Initialize schema (CREATE TABLE IF NOT EXISTS — safe to run always)
  const conn = await instance.connect();
  await initSchema(conn);

  // Auto-migrate from JSON if this is a new DB
  if (isNew) {
    await migrateJsonToDb(conn, path.resolve(DATA_DIR, repoKey));
  }

  conn.closeSync();

  cache.set(repoKey, { instance, lastAccess: Date.now() });

  // Evict old entries if cache grows too large
  if (cache.size > 20) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [key, entry] of cache) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      const old = cache.get(oldestKey);
      old?.instance.closeSync();
      cache.delete(oldestKey);
    }
  }

  return instance;
}

export async function getConnection(repoKey: string): Promise<DuckDBConnection> {
  const instance = await getDb(repoKey);
  return instance.connect();
}

/**
 * Run FORCE CHECKPOINT on a repo's DB to flush WAL to disk.
 * Call after bulk writes (e.g. collector upsert) to minimize
 * data loss window in case of sudden container termination.
 */
export async function checkpoint(repoKey: string): Promise<void> {
  const conn = await getConnection(repoKey);
  try {
    await conn.run("FORCE CHECKPOINT");
  } finally {
    conn.closeSync();
  }
}

/**
 * Delete a repository's DB, WAL, and data directory.
 * Closes the cached instance first if open.
 */
export async function deleteRepository(repoKey: string): Promise<void> {
  // Close cached instance
  const entry = cache.get(repoKey);
  if (entry) {
    try {
      entry.instance.closeSync();
    } catch {
      // ignore
    }
    cache.delete(repoKey);
  }

  // Delete the entire repo directory (DB, WAL, and any JSON dumps)
  const repoDir = path.resolve(DATA_DIR, repoKey);
  await fs.rm(repoDir, { recursive: true, force: true });
}

export async function getRepositoryKeys(): Promise<string[]> {
  const dataPath = path.resolve(DATA_DIR);
  try {
    const entries = await fs.readdir(dataPath, { withFileTypes: true });
    const keys: string[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      // Check if repo.duckdb exists OR if there are JSON dumps (will be auto-migrated)
      const hasDb = await fileExists(path.join(dataPath, entry.name, "repo.duckdb"));
      const hasJsonDumps = !hasDb && await hasJsonData(path.join(dataPath, entry.name));
      if (hasDb || hasJsonDumps) {
        keys.push(entry.name);
      }
    }
    return keys;
  } catch {
    return [];
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function hasJsonData(repoDir: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(repoDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const metadataPath = path.join(repoDir, entry.name, "metadata.json");
        if (await fileExists(metadataPath)) return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}
