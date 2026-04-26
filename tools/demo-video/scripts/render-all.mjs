#!/usr/bin/env node
// Render all four MP4 variants from their respective composition projects.
// Outputs to ../public/demo/ at repo root.

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const outDir = resolve(repoRoot, "public/demo");
mkdirSync(outDir, { recursive: true });

// Twitter-20 is intentionally excluded — its 1080x1080 square aspect
// needs square-specific sub-comp authoring (current sub-comps assume
// 1920-wide and bleed off the right edge). Re-add once
// `vignette-maja-square.html` exists.
const variants = [
  { dir: "canonical-85s", file: "personal-beats-demo.mp4", quality: "high" },
  { dir: "linkedin-60", file: "linkedin-60.mp4", quality: "high" },
  { dir: "landing-loop-10", file: "landing-loop.mp4", quality: "high" },
];

const hyperframes = resolve(here, "../node_modules/.bin/hyperframes");

for (const v of variants) {
  const projDir = resolve(here, "../variants", v.dir);
  const outPath = resolve(outDir, v.file);
  console.log(`\n▶ rendering ${v.dir} → ${outPath}`);

  const css = spawnSync("node", [resolve(here, "bundle-css.mjs")], {
    stdio: "inherit",
  });
  if (css.status !== 0) process.exit(css.status ?? 1);

  const scenes = spawnSync(
    "node",
    [resolve(here, "bundle-scenes.mjs"), v.dir],
    { stdio: "inherit" },
  );
  if (scenes.status !== 0) process.exit(scenes.status ?? 1);

  const r = spawnSync(
    hyperframes,
    ["render", "-q", v.quality, "-o", outPath],
    { stdio: "inherit", cwd: projDir },
  );
  if (r.status !== 0) {
    console.error(`render failed for ${v.dir}`);
    process.exit(r.status ?? 1);
  }
}

console.log(`\n✓ all variants rendered to ${outDir}`);
