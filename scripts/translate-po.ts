/**
 * Translate empty msgstr entries in a Lingui .po catalog using Anthropic Claude.
 * Usage: npx tsx scripts/translate-po.ts <locale> [--all]
 *   <locale>  target locale code (e.g. "pl")
 *   --all     re-translate even non-empty msgstr (default: only empty)
 *
 * Requires ANTHROPIC_API_KEY in .env.server.
 */
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadServerEnv } from "./env-loader";

loadServerEnv();

const MODEL = "claude-sonnet-4-6";
const BATCH_SIZE = 40;

const LOCALE_NAMES: Record<string, string> = {
  en: "English",
  pl: "Polish",
};

interface PoEntry {
  comments: string[];
  msgid: string;
  msgstr: string;
  raw: string;
}

function parsePo(text: string): PoEntry[] {
  const blocks = text.split(/\n\n+/);
  const entries: PoEntry[] = [];
  for (const block of blocks) {
    if (!block.trim()) continue;
    const lines = block.split(/\n/);
    const comments: string[] = [];
    let msgid = "";
    let msgstr = "";
    let mode: "none" | "id" | "str" = "none";
    for (const line of lines) {
      if (line.startsWith("#")) {
        comments.push(line);
        continue;
      }
      if (line.startsWith("msgid ")) {
        mode = "id";
        msgid = parseQuoted(line.slice(6));
      } else if (line.startsWith("msgstr ")) {
        mode = "str";
        msgstr = parseQuoted(line.slice(7));
      } else if (line.startsWith('"')) {
        const fragment = parseQuoted(line);
        if (mode === "id") msgid += fragment;
        else if (mode === "str") msgstr += fragment;
      }
    }
    entries.push({ comments, msgid, msgstr, raw: block });
  }
  return entries;
}

function parseQuoted(s: string): string {
  const m = s.trim().match(/^"((?:[^"\\]|\\.)*)"$/);
  if (!m) return "";
  return m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

function escapeQuoted(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function serializePo(entries: PoEntry[]): string {
  const out: string[] = [];
  for (const e of entries) {
    const lines: string[] = [...e.comments];
    if (e.msgid === "" && !e.comments.length) {
      // header block — keep raw
      out.push(e.raw);
      continue;
    }
    lines.push(`msgid "${escapeQuoted(e.msgid)}"`);
    lines.push(`msgstr "${escapeQuoted(e.msgstr)}"`);
    out.push(lines.join("\n"));
  }
  return out.join("\n\n") + "\n";
}

async function translateBatch(
  client: Anthropic,
  targetLocale: string,
  msgids: string[],
): Promise<string[]> {
  const targetName = LOCALE_NAMES[targetLocale] ?? targetLocale;
  const numbered = msgids.map((m, i) => `${i + 1}. ${JSON.stringify(m)}`).join("\n");

  const sys = `You translate UI strings for a web app called "Personal Beats" — a tool that turns user-described "beats" into AI-generated newsletters. Translate from English to ${targetName}.

Rules:
- Preserve ICU MessageFormat syntax exactly (e.g. {name}, {count, plural, one {...} other {...}}, <0>, <1>).
- Preserve placeholders like {name} verbatim.
- Keep tone editorial, concise, professional.
- Output ONLY a JSON array of strings, same order/length as input. No commentary.
- Do not translate brand names: "Personal Beats", "feednode", "Lemonode".
- Do not translate code-like tokens (URLs, identifiers in backticks).`;

  const user = `Translate these ${msgids.length} strings to ${targetName}. Return JSON array only.

${numbered}`;

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: sys,
    messages: [{ role: "user", content: user }],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error(`No JSON array in response: ${text.slice(0, 200)}`);
  const parsed = JSON.parse(match[0]) as string[];
  if (parsed.length !== msgids.length) {
    throw new Error(`Length mismatch: got ${parsed.length}, want ${msgids.length}`);
  }
  return parsed;
}

async function main() {
  const args = process.argv.slice(2);
  const locale = args[0];
  const all = args.includes("--all");
  if (!locale) {
    console.error("usage: tsx scripts/translate-po.ts <locale> [--all]");
    process.exit(1);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing in .env.server");
  const client = new Anthropic({ apiKey });

  const poPath = resolve(process.cwd(), `src/locales/${locale}/messages.po`);
  const text = readFileSync(poPath, "utf8");
  const entries = parsePo(text);

  const targets = entries.filter(
    (e) => e.msgid && (all || !e.msgstr.trim()),
  );
  console.log(`Found ${targets.length} entries to translate (of ${entries.length} total).`);

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const slice = targets.slice(i, i + BATCH_SIZE);
    process.stdout.write(`Batch ${i / BATCH_SIZE + 1}/${Math.ceil(targets.length / BATCH_SIZE)}… `);
    const translated = await translateBatch(client, locale, slice.map((e) => e.msgid));
    slice.forEach((e, j) => {
      e.msgstr = translated[j];
    });
    process.stdout.write("ok\n");
  }

  writeFileSync(poPath, serializePo(entries));
  console.log(`Wrote ${poPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
