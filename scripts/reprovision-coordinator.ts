/**
 * One-shot: recreate the Coordinator agent against the existing workers.
 * Used when we iterate on the Coordinator's config without disturbing
 * Designer/Scout/Editor. Writes the new ID/VERSION to .env.server.
 *
 * Run: `npx tsx scripts/reprovision-coordinator.ts`
 */
import { loadServerEnv, saveServerEnv } from "./env-loader.js";
import { createAgent } from "../src/server/agents/client.js";
import { coordinatorDefinition } from "../src/server/agents/definitions.js";

loadServerEnv();

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} missing`);
  return v;
}

async function main() {
  const body = coordinatorDefinition({
    designerId: req("BEAT_DESIGNER_AGENT_ID"),
    designerVersion: Number(req("BEAT_DESIGNER_VERSION")),
    scoutId: req("SOURCES_SCOUT_AGENT_ID"),
    scoutVersion: Number(req("SOURCES_SCOUT_VERSION")),
    editorId: req("EDITOR_AGENT_ID"),
    editorVersion: Number(req("EDITOR_VERSION")),
  });
  console.log("Creating new Coordinator...");
  const coord = await createAgent(body as unknown as Record<string, unknown>);
  console.log(`  ${coord.id} v${coord.version}`);
  saveServerEnv({
    COORDINATOR_AGENT_ID: coord.id,
    COORDINATOR_VERSION: String(coord.version),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
