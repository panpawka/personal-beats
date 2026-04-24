/**
 * One-time provisioning for Claude Managed Agents.
 *
 * Creates:
 *   - 1 shared environment         (ENVIRONMENT_ID)
 *   - 1 global_patterns memory     (GLOBAL_PATTERNS_STORE_ID) + seed docs
 *   - Beat Designer agent          (BEAT_DESIGNER_AGENT_ID/_VERSION)
 *   - Sources Scout agent          (SOURCES_SCOUT_AGENT_ID/_VERSION)
 *   - Editor agent                 (EDITOR_AGENT_ID/_VERSION)
 *   - Coordinator agent            (COORDINATOR_AGENT_ID/_VERSION)
 *
 * IDs/versions are written to .env.server. Idempotent: if all keys are set,
 * the script exits early. Pass --force to re-provision.
 *
 * Run: `npx tsx scripts/provision-agents.ts [--force]`
 */
import { loadServerEnv, saveServerEnv } from "./env-loader.js";
import {
  createAgent,
  createEnvironment,
  createMemory,
  createMemoryStore,
} from "../src/server/agents/client.js";
import {
  beatDesignerDefinition,
  coordinatorDefinition,
  editorDefinition,
  sourcesScoutDefinition,
} from "../src/server/agents/definitions.js";

const FORCE = process.argv.includes("--force");
const SEED_ONLY = process.argv.includes("--seed-only");

const REQUIRED_KEYS = [
  "ENVIRONMENT_ID",
  "GLOBAL_PATTERNS_STORE_ID",
  "BEAT_DESIGNER_AGENT_ID",
  "BEAT_DESIGNER_VERSION",
  "SOURCES_SCOUT_AGENT_ID",
  "SOURCES_SCOUT_VERSION",
  "EDITOR_AGENT_ID",
  "EDITOR_VERSION",
  "COORDINATOR_AGENT_ID",
  "COORDINATOR_VERSION",
] as const;

const GLOBAL_PATTERNS_SEEDS: Record<string, string> = {
  "/source_discovery/local_news_tactics.md": `# Local news source discovery

## Strong source types for local beats
- Municipal council agendas (often overlooked, always primary source)
- Regional/city subreddits (signal/noise varies wildly by size)
- Public transit agency official feeds
- School district announcements
- City hall press releases

## Queries that reliably find sources
- "<city>" council meetings agenda
- "<city>" subreddit
- "<city>" open data
- "<city>" RSS feed [local-language]
- "<city>" gazette OR "official journal"

## Common pitfalls
- Wikipedia "Springfield, MO" ≠ "Springfield, IL" — verify actual locality in fetched content
- "<city> news" often returns national-press stubs, not locally-reported pieces
- Facebook groups are usually gated; note the page but don't rely on it as an auto-feed
`,
  "/source_discovery/topical_beats_tactics.md": `# Topical beat source discovery

## Strong source types
- Vertical trade publications (e.g. The Information for tech business, Stat News for healthcare)
- Official project blogs / changelogs on the company/org's own domain
- Well-regarded independent newsletters in the space
- Primary research on arXiv, SSRN, NBER (topic-dependent)
- Academic or industry podcasts (RSS feed → show notes)

## Queries that work
- "<topic>" weekly OR monthly newsletter
- "<topic>" podcast RSS
- best "<topic>" publications 2026
- "<topic>" github trending (for open-source beats)

## Pitfalls
- Medium / Substack "<topic>" aggregators are often SEO spam; verify author expertise
- Avoid purely news-aggregator sites (they're third-hand) — find the primary source
`,
  "/language_hints/pl.md": `# Polish-language source hints

## Key national sources to skip for local beats
Gazeta Wyborcza, Rzeczpospolita, Onet, WP — these are national, not local.

## Queries in Polish
- "<miasto>" rada miasta (city council)
- "<miasto>" aktualności (news)
- "<miasto>" wydarzenia (events)

## Common local press patterns
- "<miasto>.naszemiasto.pl" is a template for many Polish cities
- "gazeta<miasto>.pl" also common
- Municipal sites are at "<miasto>.pl" or "um.<miasto>.pl"
`,
};

async function main() {
  loadServerEnv();

  const already = REQUIRED_KEYS.every((k) => !!process.env[k]);
  if (already && !FORCE && !SEED_ONLY) {
    console.log(
      "All agent IDs already present in .env.server. Use --force to re-provision.",
    );
    return;
  }

  const updates: Record<string, string> = {};

  // --- 1. Environment ---
  if (!process.env.ENVIRONMENT_ID || FORCE) {
    console.log("Creating environment...");
    const env = await createEnvironment({
      name: "newsroom-shared",
      config: {
        type: "cloud",
        networking: { type: "unrestricted" },
      },
    });
    updates.ENVIRONMENT_ID = env.id;
    process.env.ENVIRONMENT_ID = env.id;
    console.log(`  ENVIRONMENT_ID=${env.id}`);
  }

  // --- 2. Global patterns memory store ---
  if (!process.env.GLOBAL_PATTERNS_STORE_ID || FORCE) {
    console.log("Creating global_patterns memory store...");
    const store = await createMemoryStore(
      "Newsroom Global Patterns",
      "Cross-beat tactics for source discovery. Organized by beat type and language.",
    );
    updates.GLOBAL_PATTERNS_STORE_ID = store.id;
    process.env.GLOBAL_PATTERNS_STORE_ID = store.id;
    console.log(`  GLOBAL_PATTERNS_STORE_ID=${store.id}`);

    console.log("  Seeding starter documents...");
    for (const [path, content] of Object.entries(GLOBAL_PATTERNS_SEEDS)) {
      await createMemory(store.id, path, content);
      console.log(`    + ${path}`);
    }
  } else if (SEED_ONLY) {
    const storeId = process.env.GLOBAL_PATTERNS_STORE_ID;
    console.log(`Re-seeding existing store ${storeId}...`);
    for (const [path, content] of Object.entries(GLOBAL_PATTERNS_SEEDS)) {
      try {
        await createMemory(storeId, path, content);
        console.log(`    + ${path}`);
      } catch (err) {
        console.log(`    ~ ${path} (exists or failed): ${String(err).slice(0, 120)}`);
      }
    }
  }

  if (SEED_ONLY) {
    if (Object.keys(updates).length) saveServerEnv(updates);
    console.log("Seed-only run done.");
    return;
  }

  // --- 3. Worker agents ---
  console.log("Creating Beat Designer agent...");
  const designer = await createAgent(beatDesignerDefinition);
  updates.BEAT_DESIGNER_AGENT_ID = designer.id;
  updates.BEAT_DESIGNER_VERSION = String(designer.version);
  console.log(`  BEAT_DESIGNER_AGENT_ID=${designer.id} v${designer.version}`);

  console.log("Creating Sources Scout agent...");
  const scout = await createAgent(sourcesScoutDefinition);
  updates.SOURCES_SCOUT_AGENT_ID = scout.id;
  updates.SOURCES_SCOUT_VERSION = String(scout.version);
  console.log(`  SOURCES_SCOUT_AGENT_ID=${scout.id} v${scout.version}`);

  console.log("Creating Editor agent...");
  const editor = await createAgent(editorDefinition);
  updates.EDITOR_AGENT_ID = editor.id;
  updates.EDITOR_VERSION = String(editor.version);
  console.log(`  EDITOR_AGENT_ID=${editor.id} v${editor.version}`);

  // --- 4. Coordinator (last — references the three above) ---
  console.log("Creating Coordinator agent...");
  const coordinatorBody = coordinatorDefinition({
    designerId: designer.id,
    designerVersion: designer.version,
    scoutId: scout.id,
    scoutVersion: scout.version,
    editorId: editor.id,
    editorVersion: editor.version,
  });
  const coordinator = await createAgent(
    coordinatorBody as unknown as Record<string, unknown>,
  );
  updates.COORDINATOR_AGENT_ID = coordinator.id;
  updates.COORDINATOR_VERSION = String(coordinator.version);
  console.log(
    `  COORDINATOR_AGENT_ID=${coordinator.id} v${coordinator.version}`,
  );

  saveServerEnv(updates);
  console.log(`\nWrote ${Object.keys(updates).length} keys to .env.server`);
}

main().catch((err) => {
  console.error("Provisioning failed:", err);
  process.exit(1);
});
