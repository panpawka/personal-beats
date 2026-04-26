#!/usr/bin/env node
// Strip Tailwind-only constructs out of src/App.css and emit
// shared/app-editorial.css for HyperFrames consumption.
//
// HyperFrames renders compositions in a browser context with no
// Tailwind compiler — so `@import "tailwindcss"` and `@apply ...` lines
// fail. The rest of App.css (editorial tokens, type scale, components)
// is plain CSS and works as-is.
//
// Re-run before each `hyperframes render` to pick up App.css changes.
// Wired into npm scripts as `prerender`.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const srcCss = resolve(here, "../shared/app.css"); // symlink to repo App.css
const outCss = resolve(here, "../shared/app-editorial.css");

const raw = readFileSync(srcCss, "utf8");

const lines = raw.split("\n");
const out = [];
let inApplyBlock = false;
let bracesOpen = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();

  if (/^@import\s+["']tailwindcss["'];?\s*$/.test(trimmed)) continue;
  if (/^@tailwind\b/.test(trimmed)) continue;

  if (/@apply\b/.test(line)) {
    out.push(`/* stripped @apply: ${line.trim()} */`);
    continue;
  }

  out.push(line);
}

mkdirSync(dirname(outCss), { recursive: true });
writeFileSync(outCss, out.join("\n"), "utf8");

const stripped = lines.length - out.length;
console.log(
  `bundle-css: wrote ${outCss} (${out.length} lines, stripped ${stripped} Tailwind-only directives)`,
);
