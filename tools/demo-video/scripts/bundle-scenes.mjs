#!/usr/bin/env node
// Bundle the shared sub-composition files into a flat single-file
// HyperFrames composition for each variant. Writes
// `variants/<variant>/index.html` from a manifest.
//
// Why: HyperFrames v0.4.30's `data-composition-src` mechanism doesn't
// paint sub-composition content in our setup (shared symlinked
// compositions/), even though `info` enumerates them and lint passes.
// Diagnostic confirmed parent pipeline works with direct clips. Workaround
// is to inline every scene as a flat clip.
//
// Author once in shared/compositions/<name>.html. Build emits the flat
// file. Variants differ only in which scenes they include and at which
// time slots.
//
// CSS scoping survives transparently because each scene's CSS is
// scoped via [data-composition-id="X"] selectors which we keep — we
// just rename the attribute to data-scene-id="X" so HyperFrames's
// composition-id parsing doesn't see them.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const variants = {
  "canonical-85s": {
    width: 1920, height: 1080, duration: 68,
    scenes: [
      { id: "info-chaos",        start: 0,  duration: 8  },
      { id: "open",              start: 8,  duration: 3  },
      { id: "vignette-maja",     start: 11, duration: 17 },
      { id: "vignette-kasper",   start: 28, duration: 13 },
      { id: "vignette-ola",      start: 41, duration: 14 },
      { id: "closer",            start: 55, duration: 7  },
      { id: "product-showcase",  start: 62, duration: 3  },
      { id: "end-card",          start: 65, duration: 3  },
    ],
  },
  "linkedin-60": {
    width: 1920, height: 1080, duration: 50,
    scenes: [
      { id: "info-chaos",      start: 0,  duration: 7  },
      { id: "open",            start: 7,  duration: 3  },
      { id: "vignette-maja",   start: 10, duration: 14 },
      { id: "vignette-kasper", start: 24, duration: 13 },
      { id: "closer",          start: 37, duration: 7  },
      { id: "end-card",        start: 44, duration: 3  },
    ],
  },
  "twitter-20": {
    // 1080x1080 square — uses Maja vignette only, layout will be
    // visually clipped on the sides until square-specific scenes are
    // authored. Acceptable Phase B placeholder.
    width: 1080, height: 1080, duration: 20,
    scenes: [
      { id: "open",          start: 0,  duration: 3  },
      { id: "vignette-maja", start: 3,  duration: 14 },
      { id: "end-card",      start: 17, duration: 3  },
    ],
  },
  "landing-loop-10": {
    width: 1920, height: 1080, duration: 10,
    scenes: [
      { id: "closer",   start: 0, duration: 7 },
      { id: "end-card", start: 7, duration: 3 },
    ],
  },
};

function extractScenePieces(srcId) {
  const path = resolve(root, "shared/compositions", srcId + ".html");
  const raw = readFileSync(path, "utf8");

  // The wrapper is <div data-composition-id="X" ...> ... </div> with an
  // arbitrary number of nested divs inside. The wrapper's closing </div>
  // sits AFTER </style>/</script> at the very end of the file, so the
  // text between the wrapper-open and <style> is exactly the inner
  // content (no closing tag to strip).
  const styleStart = raw.indexOf("<style>");
  if (styleStart < 0) throw new Error(`No <style> in ${srcId}.html`);

  const openRe = new RegExp(`<div\\b[^>]*data-composition-id=["']${srcId}["'][^>]*>`);
  const openMatch = openRe.exec(raw);
  if (!openMatch) throw new Error(`No data-composition-id="${srcId}" wrapper in ${srcId}.html`);
  const openEnd = openMatch.index + openMatch[0].length;

  let innerHtml = raw.slice(openEnd, styleStart).trim();

  // CSS block — everything between <style> and </style>.
  const styleRe = /<style>([\s\S]*?)<\/style>/;
  const sm = styleRe.exec(raw);
  if (!sm) throw new Error(`No <style> in ${srcId}.html`);
  let css = sm[1];

  // JS block — the inline <script> that builds the timeline (NOT the
  // GSAP CDN script). We pick the script with `window.__timelines`.
  const scriptBlocks = [...raw.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
  let js = null;
  for (const b of scriptBlocks) {
    if (b[1].includes("window.__timelines")) {
      js = b[1];
      break;
    }
  }
  if (!js) throw new Error(`No timeline script in ${srcId}.html`);

  // Rewrite data-composition-id="X" → data-scene-id="X" everywhere
  // (HTML, CSS, JS) so HyperFrames doesn't try to treat the inner div
  // as a clip / comp.
  const swap = (s) =>
    s.replaceAll(`[data-composition-id="${srcId}"]`, `[data-scene-id="${srcId}"]`);
  innerHtml = innerHtml.replaceAll(
    `data-composition-id="${srcId}"`,
    `data-scene-id="${srcId}"`,
  );
  css = swap(css);
  js = swap(js);

  return { innerHtml, css, js };
}

function shiftJsTimes(js, offsetSec) {
  // Each scene's tweens were authored with absolute scene-local times.
  // To merge into the parent timeline we must rewrite `tl.<method>(... , N)` final
  // numeric arg to `(N + offset)`. We do this by matching the final
  // top-level numeric literal in each tl.<method>(...) call. Conservative
  // string-level rewrite — deep nesting is not used in our scenes.

  const off = Number(offsetSec);
  // Match: tl.<word>( <args> );
  // Extract the last argument's numeric literal at the same paren depth.
  const callRe = /\btl\.([a-zA-Z_]+)\s*\(([\s\S]*?)\);/g;
  return js.replace(callRe, (full, method, args) => {
    // Walk args and split on top-level commas to find the last arg.
    let depth = 0, parts = [], cur = "";
    for (let i = 0; i < args.length; i++) {
      const c = args[i];
      if (c === "{" || c === "(" || c === "[") depth++;
      else if (c === "}" || c === ")" || c === "]") depth--;
      if (c === "," && depth === 0) {
        parts.push(cur);
        cur = "";
      } else {
        cur += c;
      }
    }
    parts.push(cur);

    // Last arg should be the time scalar. If it's a bare number, shift it.
    const lastIdx = parts.length - 1;
    const last = parts[lastIdx].trim();
    const numMatch = /^([\-+]?\d*\.?\d+)$/.exec(last);
    if (!numMatch) return full; // not a numeric time — leave alone
    const shifted = (parseFloat(numMatch[1]) + off).toFixed(3).replace(/\.?0+$/, "");
    parts[lastIdx] = " " + (shifted === "" ? "0" : shifted);
    const rebuilt = parts.join(",");
    return `tl.${method}(${rebuilt});`;
  });
}

function emitVariant(variantId, cfg) {
  const sceneOuts = cfg.scenes.map((s) => {
    const { innerHtml, css, js } = extractScenePieces(s.id);
    const sceneBlock = `      <div id="${s.id}-scene" class="clip" data-scene-id="${s.id}" data-start="${s.start}" data-duration="${s.duration}" data-track-index="1" style="position:absolute;inset:0;">
${innerHtml}
      </div>`;
    let cleanedJs = shiftJsTimes(js, s.start)
      // Strip the local timeline init + registration; we share the parent timeline.
      .replace(/^\s*window\.__timelines\s*=.*$/m, "")
      .replace(/^\s*const\s+tl\s*=\s*gsap\.timeline\([^)]*\);\s*$/m, "")
      .replace(/^\s*window\.__timelines\[[^\]]+\]\s*=\s*tl;\s*$/m, "");
    return {
      sceneBlock,
      css: `\n      /* ───── ${s.id} (${s.start}..${s.start + s.duration}s) ───── */\n` + css,
      // IIFE-wrap so each scene's `const ns = ...` and other locals don't
      // collide with siblings when multiple scenes inline into one
      // <script>. The shared `tl` reference is hoisted via closure.
      js: `\n      // ───── ${s.id} (offset +${s.start}s) ─────\n      (function(){\n${cleanedJs}\n      })();`,
    };
  });

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${cfg.width}, height=${cfg.height}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,500;0,8..60,600;1,8..60,400&family=Geist:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap" />
    <link rel="stylesheet" href="../../shared/app-editorial.css" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body {
        margin: 0; width: ${cfg.width}px; height: ${cfg.height}px;
        overflow: hidden; background: oklch(0.985 0.006 75);
      }
      /* ───── global brand wordmark (top-right, persists across all scenes) ───── */
      .pb-brand {
        position: absolute;
        right: 80px; top: 60px;
        font-size: 18px;
        line-height: 1;
        letter-spacing: 0;
        z-index: 9999;
        white-space: nowrap;
        text-align: right;
      }
      .pb-brand-row {
        display: block;
      }
      .pb-brand .pb-personal {
        font-family: "Geist", ui-sans-serif, system-ui, sans-serif;
        font-weight: 600;
        font-size: 22px;
        letter-spacing: -0.005em;
        color: oklch(0.22 0.012 70);
      }
      .pb-brand .pb-beats {
        margin-left: 8px;
        font-family: "Source Serif 4", Georgia, serif;
        font-style: italic;
        font-weight: 600;
        font-size: 22px;
        letter-spacing: -0.005em;
        color: oklch(0.58 0.18 25);
      }
      .pb-brand .pb-powered {
        display: block;
        margin-top: 6px;
        font-family: "JetBrains Mono", ui-monospace, monospace;
        font-size: 10.5px;
        font-weight: 500;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: oklch(0.52 0.008 70);
      }
${sceneOuts.map((s) => s.css).join("\n")}
    </style>
  </head>
  <body>
    <div
      id="root"
      data-composition-id="${variantId}"
      data-start="0"
      data-duration="${cfg.duration}"
      data-width="${cfg.width}"
      data-height="${cfg.height}"
    >
${sceneOuts.map((s) => s.sceneBlock).join("\n")}
      <div class="pb-brand"><span class="pb-brand-row"><span class="pb-personal">Personal</span><span class="pb-beats">Beats</span></span><span class="pb-powered">Powered by Claude Opus 4.7</span></div>
    </div>

    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
${sceneOuts.map((s) => s.js).join("\n")}
      window.__timelines["${variantId}"] = tl;
    </script>
  </body>
</html>
`;

  const outPath = resolve(root, "variants", variantId, "index.html");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html, "utf8");
  console.log(`bundle-scenes: wrote ${outPath} (${cfg.scenes.length} scenes, ${cfg.duration}s)`);
}

const only = process.argv[2]; // optional single variant
for (const [id, cfg] of Object.entries(variants)) {
  if (only && only !== id) continue;
  emitVariant(id, cfg);
}
