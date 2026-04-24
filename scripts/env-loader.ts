import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ENV_PATH = resolve(process.cwd(), ".env.server");

export type EnvMap = Record<string, string>;

export function loadServerEnv(): EnvMap {
  if (!existsSync(ENV_PATH)) {
    throw new Error(`.env.server not found at ${ENV_PATH}`);
  }
  const raw = readFileSync(ENV_PATH, "utf8");
  const out: EnvMap = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    out[key] = value;
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
  return out;
}

/**
 * Upsert keys into .env.server. Preserves existing order and comments.
 * New keys appended at the end.
 */
export function saveServerEnv(updates: EnvMap): void {
  const existing = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8") : "";
  const lines = existing ? existing.split(/\r?\n/) : [];
  const touched = new Set<string>();

  const next = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;
    const eq = trimmed.indexOf("=");
    if (eq === -1) return line;
    const key = trimmed.slice(0, eq).trim();
    if (key in updates) {
      touched.add(key);
      return `${key}=${updates[key]}`;
    }
    return line;
  });

  for (const [key, value] of Object.entries(updates)) {
    if (!touched.has(key)) {
      next.push(`${key}=${value}`);
    }
  }

  // ensure trailing newline
  const out = next.join("\n");
  writeFileSync(ENV_PATH, out.endsWith("\n") ? out : `${out}\n`);
}
