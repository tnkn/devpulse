import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

const DATA_DIR = process.env.DATA_DIR || "./data";
const KEY_FILE = path.resolve(DATA_DIR, ".encryption_key");

let cachedKey: Buffer | null = null;

async function getEncryptionKey(): Promise<Buffer> {
  if (cachedKey) return cachedKey;

  // 1. Environment variable takes priority
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey) {
    cachedKey = Buffer.from(envKey, "hex");
    if (cachedKey.length !== KEY_LENGTH) {
      throw new Error(
        `ENCRYPTION_KEY must be ${KEY_LENGTH * 2} hex characters (${KEY_LENGTH} bytes)`,
      );
    }
    return cachedKey;
  }

  // 2. Read from file, or generate if missing
  try {
    const hex = await fs.readFile(KEY_FILE, "utf-8");
    cachedKey = Buffer.from(hex.trim(), "hex");
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const key = randomBytes(KEY_LENGTH);
    await fs.writeFile(KEY_FILE, key.toString("hex"), { mode: 0o600 });
    cachedKey = key;
  }

  return cachedKey;
}

export interface EncryptedData {
  ciphertext: string; // hex
  iv: string; // hex
  authTag: string; // hex
}

export async function encrypt(plaintext: string): Promise<EncryptedData> {
  const key = await getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf-8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString("hex"),
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  };
}

export async function decrypt(data: EncryptedData): Promise<string> {
  const key = await getEncryptionKey();
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(data.iv, "hex"),
  );
  decipher.setAuthTag(Buffer.from(data.authTag, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(data.ciphertext, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf-8");
}
