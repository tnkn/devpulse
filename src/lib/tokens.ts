import { randomUUID } from "node:crypto";
import { decrypt, encrypt } from "@/lib/crypto";
import { getTokenConnection } from "@/lib/db/tokens";
import type { GitHubTokenMasked } from "@/types";

export function isTokenUIAllowed(): boolean {
  return process.env.ALLOW_TOKEN_UI !== "false";
}

export async function listTokens(): Promise<GitHubTokenMasked[]> {
  const conn = await getTokenConnection();
  try {
    const reader = await conn.runAndReadAll(
      "SELECT id, label, token_suffix, is_default, created_at, updated_at FROM github_tokens ORDER BY created_at",
    );
    const rows = reader.getRows();
    return rows.map((row) => ({
      id: String(row[0]),
      label: String(row[1]),
      token_suffix: String(row[2]),
      is_default: Boolean(row[3]),
      created_at: String(row[4]),
      updated_at: String(row[5]),
    }));
  } finally {
    conn.closeSync();
  }
}

export async function addToken(
  label: string,
  token: string,
): Promise<GitHubTokenMasked> {
  const id = randomUUID();
  const suffix = token.slice(-4);
  const { ciphertext, iv, authTag } = await encrypt(token);

  const conn = await getTokenConnection();
  try {
    // If this is the first token, make it default
    const countReader = await conn.runAndReadAll(
      "SELECT COUNT(*) FROM github_tokens",
    );
    const countRows = countReader.getRows();
    const count = Number(countRows[0][0]);
    const isDefault = count === 0;

    await conn.run(
      `INSERT INTO github_tokens (id, label, encrypted_token, iv, auth_tag, token_suffix, is_default)
       VALUES ('${id}', '${label.replace(/'/g, "''")}', '${ciphertext}', '${iv}', '${authTag}', '${suffix}', ${isDefault})`,
    );

    return {
      id,
      label,
      token_suffix: suffix,
      is_default: isDefault,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  } finally {
    conn.closeSync();
  }
}

export async function updateToken(
  id: string,
  updates: { label?: string; is_default?: boolean },
): Promise<void> {
  const conn = await getTokenConnection();
  try {
    if (updates.is_default) {
      await conn.run(
        "UPDATE github_tokens SET is_default = FALSE WHERE is_default = TRUE",
      );
    }

    const sets: string[] = [];
    if (updates.label !== undefined) {
      sets.push(`label = '${updates.label.replace(/'/g, "''")}'`);
    }
    if (updates.is_default !== undefined) {
      sets.push(`is_default = ${updates.is_default}`);
    }
    sets.push(`updated_at = strftime(now(), '%Y-%m-%dT%H:%M:%SZ')`);

    await conn.run(
      `UPDATE github_tokens SET ${sets.join(", ")} WHERE id = '${id}'`,
    );
  } finally {
    conn.closeSync();
  }
}

export async function deleteToken(id: string): Promise<void> {
  const conn = await getTokenConnection();
  try {
    // Check if we're deleting the default token
    const reader = await conn.runAndReadAll(
      `SELECT is_default FROM github_tokens WHERE id = '${id}'`,
    );
    const rows = reader.getRows();
    const wasDefault = rows.length > 0 && Boolean(rows[0][0]);

    await conn.run(`DELETE FROM github_tokens WHERE id = '${id}'`);

    // If deleted token was default, promote the oldest remaining token
    if (wasDefault) {
      await conn.run(
        `UPDATE github_tokens SET is_default = TRUE
         WHERE id = (SELECT id FROM github_tokens ORDER BY created_at LIMIT 1)`,
      );
    }
  } finally {
    conn.closeSync();
  }
}

/**
 * Returns all available tokens (DB tokens + env var), deduplicated.
 */
export async function getAllDecryptedTokens(): Promise<string[]> {
  const tokens: string[] = [];

  // DB tokens
  try {
    const conn = await getTokenConnection();
    try {
      const reader = await conn.runAndReadAll(
        "SELECT encrypted_token, iv, auth_tag FROM github_tokens ORDER BY is_default DESC, created_at",
      );
      const rows = reader.getRows();
      for (const row of rows) {
        try {
          const t = await decrypt({
            ciphertext: String(row[0]),
            iv: String(row[1]),
            authTag: String(row[2]),
          });
          tokens.push(t);
        } catch {
          // skip corrupted token
        }
      }
    } finally {
      conn.closeSync();
    }
  } catch {
    // DB not available
  }

  // Env var (add only if not already present from DB)
  const envToken = process.env.GITHUB_TOKEN;
  if (envToken && !tokens.includes(envToken)) {
    tokens.push(envToken);
  }

  return tokens;
}

export async function getDecryptedDefaultToken(): Promise<string | null> {
  const conn = await getTokenConnection();
  try {
    const reader = await conn.runAndReadAll(
      "SELECT encrypted_token, iv, auth_tag FROM github_tokens WHERE is_default = TRUE LIMIT 1",
    );
    const rows = reader.getRows();
    if (rows.length === 0) return null;

    return decrypt({
      ciphertext: String(rows[0][0]),
      iv: String(rows[0][1]),
      authTag: String(rows[0][2]),
    });
  } finally {
    conn.closeSync();
  }
}

export async function getDecryptedToken(id: string): Promise<string | null> {
  const conn = await getTokenConnection();
  try {
    const reader = await conn.runAndReadAll(
      `SELECT encrypted_token, iv, auth_tag FROM github_tokens WHERE id = '${id}'`,
    );
    const rows = reader.getRows();
    if (rows.length === 0) return null;

    return decrypt({
      ciphertext: String(rows[0][0]),
      iv: String(rows[0][1]),
      authTag: String(rows[0][2]),
    });
  } finally {
    conn.closeSync();
  }
}

export async function testToken(
  token: string,
): Promise<{ valid: boolean; login?: string; error?: string }> {
  try {
    const res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!res.ok) {
      return { valid: false, error: `GitHub API returned ${res.status}` };
    }
    const data = await res.json();
    return { valid: true, login: data.login };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
