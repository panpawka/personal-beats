/**
 * Recreate Beat Designer, Sources Scout, Editor with updated prompts.
 * Writes new IDs/versions to .env.server.
 */
import { loadServerEnv, saveServerEnv } from "./env-loader.js";
import { createAgent } from "../src/server/agents/client.js";
import {
  beatDesignerDefinition,
  editorDefinition,
  sourcesScoutDefinition,
} from "../src/server/agents/definitions.js";

loadServerEnv();

async function main() {
  console.log("Creating Beat Designer...");
  const designer = await createAgent(beatDesignerDefinition);
  console.log(`  ${designer.id} v${designer.version}`);

  console.log("Creating Sources Scout...");
  const scout = await createAgent(sourcesScoutDefinition);
  console.log(`  ${scout.id} v${scout.version}`);

  console.log("Creating Editor...");
  const editor = await createAgent(editorDefinition);
  console.log(`  ${editor.id} v${editor.version}`);

  saveServerEnv({
    BEAT_DESIGNER_AGENT_ID: designer.id,
    BEAT_DESIGNER_VERSION: String(designer.version),
    SOURCES_SCOUT_AGENT_ID: scout.id,
    SOURCES_SCOUT_VERSION: String(scout.version),
    EDITOR_AGENT_ID: editor.id,
    EDITOR_VERSION: String(editor.version),
  });
  console.log("Wrote updated IDs to .env.server");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
