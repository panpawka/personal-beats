# DESIGN.md — Personal Newsroom Agent

**Status:** Binding spec · MVP · hackathon
**Owner:** Pawel
**Stack:** Wasp 0.23 + React 19 + Tailwind v4 + react-email 6
**Source aesthetic:** ClaudeOS v2 design bundle (`claude.ai/design` handoff, 2026-04-23)
**PRD:** `PRD.md`, `PRD_wasp.md`, `PRD_cma.md`

---

## 1. Purpose & non-goals

DESIGN.md is the **binding source of truth** for every pixel of Personal Newsroom Agent's UI. Before shipping any new page, component, Tailwind class, CSS token, auth form, landing section, dashboard card, chart, button, input, table, sidebar, modal, empty/error state, or email template, read this document top-to-bottom and satisfy the MUST checklist in §8.

### What this supersedes

Earlier project instructions referenced a DESIGN.md mandating amber `#FBBF07`, `rounded-none`, Lucide + MD-filled marketing icons, and Polish-first copy. **Those rules are retired.** This document replaces them.

### Non-goals for MVP

- Light mode (dark-only until post-hackathon).
- Internationalized UI chrome (English-only; newsletter output can be any language).
- Mobile-first breakpoints (desktop-first, responsive down to 768px only).
- Animation-free/reduced-motion fallback beyond the system `prefers-reduced-motion` hook in §5.
- Custom illustration work (hand-drawn SVGs, portraits, mascots — skip entirely).

---

## 2. Design system tokens

All tokens live in `src/App.css` as a Tailwind v4 `@theme` block plus a `:root` fallback. **Never hand-roll a hex outside this file.**

### 2.1 Palette (OKLCH)

```css
:root {
  /* Ink (foreground) */
  --ink:        #f5f3ef;                 /* primary text */
  --ink-dim:    rgba(245,243,239,0.62);  /* secondary text */
  --ink-faint:  rgba(245,243,239,0.38);  /* tertiary / labels */

  /* Surfaces */
  --bg:         #07070a;                 /* page */
  --bg-card:    #0d0d12;                 /* card */
  --bg-elev:    #141419;                 /* elevated / modal / chat shell */

  /* Dividers */
  --line:        rgba(245,243,239,0.08);
  --line-strong: rgba(245,243,239,0.16);

  /* Accent & hue family */
  --accent: oklch(0.72 0.18 48);   /* warm amber — primary brand */
  --violet: oklch(0.58 0.22 295); /* deep work / async beat */
  --teal:   oklch(0.70 0.14 190); /* craft / writer beat */
  --rose:   oklch(0.68 0.20 10);  /* signal / alert beat */
  --cyan:   oklch(0.75 0.15 220); /* research beat */
  --lime:   oklch(0.80 0.17 130); /* ok / healthy status */

  /* Semantic */
  --ok:      oklch(0.82 0.18 145);
  --warn:    oklch(0.85 0.18 55);
  --err:     oklch(0.68 0.22 22);
}
```

**Per-beat hue:** every beat is assigned one hue from the `--violet | --teal | --rose | --cyan | --lime | --accent` family at creation and used for its card glow, icon gradient, and issue-viewer hero. Proposed persistence: a `hue` int column (0–360) on the `Beat` row — final shape deferred to `PRD_wasp.md`. Prefer `oklch(L C H)` spun against that hue — do not pick fresh hexes.

**Amber `#FBBF07` is forbidden.** The old brand amber has been replaced by `--accent` (`oklch(0.72 0.18 48)`).

### 2.2 Typography

Three families, loaded via Google Fonts in `index.html`:

| Family              | Weights         | Use                                   |
|---------------------|-----------------|---------------------------------------|
| Inter               | 300/400/500/600/700/800 | UI text, buttons, inputs, body |
| Instrument Serif    | 400, 400 italic | Hero titles, questions, beat names (display only) |
| JetBrains Mono      | 400/500/600     | Stats, labels, timestamps, codes, kbd |

Body default: `font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; font-feature-settings: "ss01","cv11";`.

**Hero pattern:** Inter 400 mixed with Instrument Serif italic, gradient-clipped for the emphasis span.

```tsx
<h1 className="font-serif text-[64px] leading-[1.02] tracking-[-0.02em]">
  A 5-minute brief.<br/>
  <span className="italic bg-gradient-to-r from-[oklch(0.85_0.15_55)] to-[oklch(0.65_0.20_295)] bg-clip-text text-transparent">
    A newsroom for life.
  </span>
</h1>
```

### 2.3 Radius

No `rounded-none`. Scale: `4 / 6 / 8 / 10 / 12 / 14 / 18 / 22 / 999`.

| Token                | Used for                       |
|----------------------|--------------------------------|
| `4px`  / `rounded-sm`| depth badges, ingredient chips |
| `8px`  / `rounded-md`| ingredient chips, small pills  |
| `10px` / `rounded-lg`| buttons, ghost buttons         |
| `12px` / `rounded-xl`| primary buttons, prompt chips  |
| `14px` / `rounded-2xl`| chat input, timeline nodes    |
| `18px` / `rounded-[18px]`| beat cards                 |
| `22px` / `rounded-[22px]`| hero / featured card       |
| `999px` / `rounded-full`| pills, tabs, avatars, stickers |

### 2.4 Spacing & layout

- Base grid: 8px. Hero compositions use 24/28/32/40 between blocks.
- Artboard safe area: 60–80px horizontal, 70–80px top, 40–50px bottom on desktop.
- Content max-width: 1280px for dashboard, 720px for chat shells, 640px for email body.

### 2.5 Elevation

Shadows favor **warm black with soft spread**; never use `box-shadow` with blue-gray hints.

```css
--shadow-card:   0 10px 24px rgba(0,0,0,0.35);
--shadow-lifted: 0 20px 40px rgba(0,0,0,0.50);
--shadow-hero:   0 30px 80px rgba(0,0,0,0.60);
--shadow-btn:    0 10px 30px rgba(255,255,255,0.08);
--shadow-btn-hover: 0 14px 40px rgba(255,255,255,0.14);
```

### 2.6 Motion tokens

```css
--ease-lift: cubic-bezier(.2,.8,.2,1);
--ease-dim:  cubic-bezier(.2,.7,.2,1);
--dur-hover: 0.3s;
--dur-lift:  0.55s;
--dur-tab:   0.15s;
```

### 2.7 Grain overlay

Every top-level dark surface gets the SVG turbulence grain at 50% opacity, `mix-blend-mode: overlay`. Single class `.grain` — see §4 components.

---

## 3. Surface map (PRD → design)

Every surface in `PRD.md` §3 (User stories) and §4 (Architecture) maps to exactly one ClaudeOS pattern, renamed to Personal Newsroom vocabulary:

| ClaudeOS term | Personal Newsroom term | Why                              |
|---------------|------------------------|----------------------------------|
| bundle        | **beat**               | the PRD's core unit              |
| persona       | **beat spec**          | what the Beat Designer produces  |
| ingredient    | **source**             | MCP / RSS / web fetch            |
| deck          | **dashboard**          | user's home                      |
| tier (Starter/Pro/Signature) | **depth** (brief/standard/deep) | PRD §2 |
| install CTA   | **activate / pause**   | Wasp job scheduling              |

### 3.1 Landing / marketing  →  *Split-preview*

Pre-auth `/` route. Two-column hero.

- **Left (1.1fr):** small mono kicker `PERSONAL NEWSROOM · v0.1`, Instrument Serif hero `A one-sentence brief.` / italic gradient `A newsroom for life.`, Inter dim subtitle, chat-style composer input (backdrop-blur, `rounded-2xl`), three-step mono dotline `◯ interview · ◯ spec · ◯ newsletter`.
- **Right (1fr):** vertical "how a beat composes" stack, 3 numbered rows: (1) a sample Q "What do you care about?" → (2) a beat-spec card materializing (avatar + serif italic title + trait chips) → (3) a 3-up mini-beat row preview. Dashed animated flow line links rows on desktop ≥1200px.
- Grain + two radial orbs (violet top-left, amber bottom-right). Logo top-left. `open beta` pill top-right.

CTA primary: `Begin →` (Inter 600 14px, ink on bg, `rounded-xl`, `--shadow-btn`).

### 3.2 Dashboard (my beats)  →  *Bundle-card grid*

Authed `/` route. Each beat is a card.

- Top strip: mono kicker `YOUR DESK · N ACTIVE`, serif italic title `Pick the ones that earn their keep.`, right-aligned filter pills (`all cadences`, `sort · next-run`).
- Grid: `grid-cols-3 gap-4` desktop, `grid-cols-2` tablet, `grid-cols-1` mobile.

**Beat card anatomy** (adapted from `.bundle-v2`):
- Outer: `rounded-[18px]` `bg-[#0d0d12]` `border border-[var(--line)]` with per-beat `--card-aura` radial gradient behind (using the beat's hue).
- Header row: 44×44 icon tile (`rounded-xl`, `radial-gradient` using beat hue + hue+40°, inset highlight shadow), title stack (depth badge → beat name Inter 600 15px → tagline Inter 400 11px dim).
- Meta row (Mono 10px): `<Clock/> cadence` · `<Bolt/> next issue in Xh` (lime text).
- Includes row: mono `SOURCES · n`, flex-wrap of typed `.source` chips (see §4.6).
- CTA row: primary `Run now` + ghost `View issues` · ghost `Pause`.

**Hover:** card lifts `translateY(-6px)`, shadow `--shadow-lifted`, border upgrades to `--line-strong`, neighbors unaffected. **In a featured view (single active card),** neighbors dim via `filter: brightness(0.55) saturate(0.7)` — hover row pattern.

Empty state: a single dashed-border tile "No beats yet — [Create your first beat →]".

### 3.3 Beat creation  →  *Palette + Timeline* hybrid

`/beats/new` route. Streams from the Beat Designer via SSE.

- **Modal-like shell** (`.chat-shell`, max-width 720px, centered) appears over dimmed dashboard when user clicks "Create a new beat". Backdrop `backdrop-blur-md` over `rgba(7,7,10,0.75)`.
- **Entry:** a palette-style single `<input>` (22px Inter on transparent, no border, `Sparkle` icon left, `⏎` kbd right). Placeholder: `"Describe what you want Claude to cover…"`.
- **Stream starts:** the palette morphs into a **3-column timeline layout** (`220px 1fr 260px`):
  - **Left rail — Q&A log.** Mono kicker `ANSWERED · k`. Vertical line of 20×20 nodes; answered nodes = `--ok` filled with `<Check/>`, current = accent→violet gradient-filled, pending = subtle ring.
  - **Center — NOW.** Mono kicker `NOW`. Current question in Serif italic 36px with gradient-clipped emphasis. Below: trait-pill multi-select or free text, depending on Beat Designer prompt type.
  - **Right — LIVE BEAT SPEC.** Mono kicker `SPEC · forming`. A `.persona-card`-shaped container showing: avatar-style gradient tile with beat hue, serif italic beat title (auto-generated, e.g. *"The Wrocław Weekend Scout"*), `.trait` chips (topic · geo · cadence · depth · lang), and a stat row for focus/reach/craft/signal analogues — rename for newsletter: `depth`, `freshness`, `breadth`, `signal` each 0–100.

- **Clarifier gate** (PRD §5): if Beat Designer has <2 clarifying questions, skip straight to "Review your brief → Activate". If ≥1 question, the center panel renders the question with max 4 suggested answers + "type my own" fallback.

- **Completion:** left rail fully green, center collapses into a full-width summary, primary CTA **`Activate beat`**, ghost **`Edit answers`**. Activation triggers the first run.

### 3.4 Issue viewer

`/beats/:id/issues/:issueId` route. One newsletter issue.

- Hero (`.persona-card` adapted): glow band using the beat's hue, mono kicker `ISSUE · N · DATE`, Serif italic issue title, beat name in Inter 500 dim below, thumbs-up/down pair floating right.
- Item list: each item is a row with (a) left gutter showing favicon of source + hue strip, (b) Inter 600 15px headline, (c) Inter 400 13px dim summary, (d) `.source` chips for provenance (e.g. `RSS · BBC`, `WEB · council.gov.pl`), (e) inline thumbs ±. Rows separated by `border-t var(--line)`.
- "Editor's note" for thin coverage renders as a sticker-badge at the top of the list, serif italic 14px.
- Footer: `<- Previous issue · All issues · Next issue ->` mono 10px, plus `Was this useful?` thumbs pair.

### 3.5 Auth pages (`/login`, `/signup`, `/request-password-reset`, `/password-reset`, `/email-verification`)

Already scaffolded by Wasp. Re-skin to this spec: apply tokens from §2, wrap the Wasp `<LoginForm>` / `<SignupForm>` in the `.chat-shell` shell from §4.9, center on a dark grain surface (§2.7). No bespoke layout — just tokens + shell. Inputs inherit the chat-composer treatment (transparent bg, ink text, faint placeholder). Primary action uses `.btn-primary`. Link copy in `Inter 500 13px text-[var(--ink-dim)]` with `underline`. `App.tsx` currently renders light-mode Tailwind (`bg-neutral-50 text-neutral-800`) — that is **non-compliant** and must be swapped before auth is touched.

### 3.6 Feedback confirmation (magic-link target)

`/feedback/:token` route. Zero-chrome, single sticker-badge center of page: "Thanks — we'll tune the next issue." with a 400ms `pulse-dot` check icon. Redirects to the issue viewer after 2s or on click.

### 3.7 Email template (react-email 6)

Newsletter is delivered by email; not all tokens survive.

**Must-preserve:**
- Inter web font via `<link>` in email head; fall back to `Helvetica Neue, Arial`.
- Instrument Serif for the issue title (inline `<style>` or `<font>`); fall back to `Georgia, serif`.
- Dark background `#07070a` is **allowed** but many clients force light — so send dual-mode: `@media (prefers-color-scheme: dark)` with dark tokens, default light mode with `#fafaf7` bg, `#0d0d12` ink, the beat's hue flattened to a solid `oklch(0.68 0.16 H)` → sRGB via build-time conversion. **Do not emit `oklch()` in email CSS** — react-email ships sRGB.
- Source chips render as inline-block pills with solid 1px border.
- No keyframe animations. No backdrop-blur. No radial gradients — use a 4px color bar left of the title block instead of glow.

Plain-text fallback: a formatted text version with `---` separators and `[+]`/`[-]` magic-link tokens.

---

## 4. Components catalogue

All class names live in `src/App.css` under `@layer components` or as `@utility` definitions. JSX imports nothing but Tailwind classes — no CSS-in-JS except inline style for dynamic hue interpolation (`style={{ '--beat-hue': beat.hue }}`).

### 4.1 `.btn-primary`

```css
@utility btn-primary {
  @apply inline-flex items-center gap-2 rounded-xl
         px-[18px] py-3 text-sm font-semibold
         bg-[var(--ink)] text-[#0a0a0f]
         transition-transform;
  box-shadow: var(--shadow-btn);
}
.btn-primary:hover { transform: translateY(-1px); box-shadow: var(--shadow-btn-hover); }
```

States: default / hover / `:disabled` (opacity-50, no lift) / `aria-busy` (shimmer keyframe on text).

### 4.2 `.btn-ghost`

`inline-flex px-3.5 py-2.5 rounded-lg text-[13px] font-medium border border-[var(--line-strong)] text-[var(--ink)] bg-transparent`. Hover: `bg-[rgba(245,243,239,0.04)]`.

### 4.3 `.pill` / `.pill.mono`

Status/label pill. 6×10px padding, `rounded-full`, `text-[11px]` Inter, optional `.mono` → JetBrains Mono 500. Background `rgba(245,243,239,0.06)`, border `var(--line)`. Used for: filters, tags, cadence display, beta markers.

### 4.4 `.sticker`

Solid paper-colored sticker-badge. `bg-[#f5f3ef] text-[#0a0a0f] rounded-full px-2.5 py-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider`. Dual shadow (1px drop + 6/14px soft). Used for: "NEW", "Activated", post-action confirmations.

### 4.5 `.trait`

`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[rgba(245,243,239,0.06)] border border-[var(--line)] text-[11px] text-[var(--ink)] font-mono` with a 6×6 dot using the beat hue. Used for beat-spec chips in creation flow.

### 4.6 `.source` (renamed from `.ingredient`)

Typed source chip. Two sub-elements: `.source-kind` (mono 8px uppercase, kind-colored) + `.source-name` (Inter 500 10px ink). Borders and bg use `--line` / `rgba(245,243,239,0.04)`.

| Kind       | Kind color                      | When                                    |
|------------|--------------------------------|----------------------------------------|
| `rss`      | `oklch(0.80 0.12 190)` (teal)  | RSS feed                                |
| `web`      | `oklch(0.75 0.18 295)` (violet)| Playwright / requests web fetch         |
| `api`      | `oklch(0.85 0.18 55)`  (amber) | Structured API (news APIs, gov open data) |
| `mcp`      | `oklch(0.68 0.20 10)`  (rose)  | MCP connector (Gmail/Slack/etc)         |

### 4.7 `.depth-badge` (renamed from `.tier`)

PRD §2 depths. `inline-flex px-2 py-0.5 rounded-sm text-[9px] font-mono font-semibold uppercase tracking-[0.1em] border`.

| Depth      | Class            | Color                              |
|------------|------------------|------------------------------------|
| `brief`    | `.depth-brief`   | `oklch(0.80 0.12 190)` teal        |
| `standard` | `.depth-std`     | `oklch(0.75 0.18 295)` violet      |
| `deep`     | `.depth-deep`    | `oklch(0.85 0.18 55)` amber        |

### 4.8 `.beat-card` (renamed from `.bundle-v2`)

Full anatomy in §3.2. Root uses CSS custom property `--card-aura` set from `beat.hue` at render.

```tsx
<article
  className="beat-card"
  style={{ ['--card-aura' as any]:
    `radial-gradient(80% 100% at 50% 0%, oklch(0.70 0.18 ${beat.hue} / 0.35), transparent 60%)` }}>
  {/* header / meta / sources / cta */}
</article>
```

### 4.9 `.chat-shell`

Centered composer shell for beat creation. `max-w-[720px] w-full rounded-[18px] bg-[rgba(20,20,26,0.85)] border border-[var(--line-strong)] backdrop-blur-xl shadow-[var(--shadow-hero)]`.

### 4.10 `.msg` (chat bubbles)

- `.msg.you`: user message, `rounded-2xl rounded-br-[4px]`, `bg-[rgba(245,243,239,0.06)]`, aligned right.
- `.msg.os`: Claude message, transparent, no padding-x, aligned left, title-style.

### 4.11 `.stat-row`

`flex items-center gap-2.5`. Label mono 10px uppercase width 60px, track `flex-1 h-1 rounded-sm bg-[rgba(245,243,239,0.08)]`, fill gradient from hue → hue+30°, val mono 11px 28px right-aligned.

### 4.12 `.os-chrome`

Top-of-page mono breadcrumb: `personal-beat / {path} · ● ready`. Mono 11px tracking-wider. Dot uses `--ok` with glow.

### 4.13 `.persona-card` → `.spec-card`

Renamed. Glow band container for beat-spec previews and issue-viewer hero. Position-relative with an inner `.spec-glow` absolutely-positioned, blurred, `inset: auto -20% -40% -20%`, height 75%, bg radial using beat hue.

### 4.14 `.variant-tabs` + `.variant-tab`

Only used if a surface offers toggles (e.g. dashboard view: grid vs featured vs hover-row). Pill strip, JetBrains Mono 11px uppercase. Active tab gets ink bg + dark text.

### 4.15 Streaming typing indicators

- `.typing-dot` — 3 dots animating via `pulse-dot` keyframe, staggered 0.2s / 0.4s. For SSE waiting states.
- `.caret` — 2px × 1em ink bar via `::after`, `caret` keyframe. Append to the last streamed line.

---

## 5. Motion rules

Keyframes ship globally in `App.css`:

```css
@keyframes float       { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
@keyframes pulse-dot   { 0%,100% { opacity: 0.25 } 50% { opacity: 1 } }
@keyframes shimmer     { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }
@keyframes caret       { 0%,49% { opacity: 1 } 50%,100% { opacity: 0 } }
@keyframes dash        { to { stroke-dashoffset: -20 } }
```

### 5.1 Interaction patterns

- **Card hover lift:** `transform: translateY(-6px)` + `box-shadow: var(--shadow-lifted)` + `border-color: var(--line-strong)`. Duration `var(--dur-hover)`, ease `var(--ease-lift)`.
- **Row hover — dim neighbors:** parent listens on `:hover` and sets non-hovered children to `filter: brightness(0.55) saturate(0.7)`. Hovered child rises with `z-index: 10` and expands via `flex: 2.6 1 0`. Duration `var(--dur-lift)`. **Only used on the dashboard's "featured" view**, not the default grid.
- **Flow link:** 1px dashed stroke SVG with `stroke-dasharray: 4 6`, animated via `dash` keyframe. Used on the landing "how it composes" column.
- **SSE streaming:** append `.caret` to the last incomplete line. On completion, swap caret for a `<Check>` in `--ok`.
- **Empty → filled transitions:** no flash. Fade content in over 0.3s ease-out.

### 5.2 Reduced motion

Honor `@media (prefers-reduced-motion: reduce)`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## 6. Icon system

Lucide-style stroke icons at 14–22px, `stroke-width: 2`, `stroke-linecap: round`, `stroke-linejoin: round`. No fills except where noted. Icon set is the one already proven in the design bundle's `SharedIcons` (shared.jsx): **Arrow, Plus, Sparkle (filled), Mic, Attach, Send, Check, Bolt (filled), Clock, Github, Calendar, Mail, Slack, Chart, Brain, Search**.

- Use Lucide React (`lucide-react`) in production. Map 1:1 to the design bundle names.
- **No MD-filled marketing icons.** No emojis in UI chrome. Emojis allowed inside newsletter item bodies if the source carried them.
- Brand mark (`CosLogo` → rename `PNLogo`): gradient-stroked outer ring + gradient-filled inner dot + a small satellite dot. Gradient = amber → violet. Wordmark `Personal` + dim `Newsroom`.

---

## 7. Accessibility

### 7.1 Contrast

- `--ink` on `--bg`: L diff ≈ 91 — comfortably AAA.
- `--ink-dim` on `--bg`: must re-verify per surface; target ≥ 4.5:1 for body text. If a dim span falls below, promote to `--ink`.
- Hue-tinted text (e.g. `--ok`, `--err`) used only for labels of ≥ 11px **bold**; never for body copy.

### 7.2 Focus rings

All interactive elements get a visible focus ring: `outline: 2px solid var(--accent); outline-offset: 2px; border-radius: inherit;`. No `outline: none` without a replacement.

### 7.3 Keyboard

- ⌘K (macOS) / Ctrl+K opens the Create-a-beat palette anywhere in the dashboard.
- `↑` / `↓` navigate palette suggestions, `⏎` selects, `esc` cancels.
- Dashboard card grid supports arrow-key navigation between cards; `⏎` opens the beat, `space` toggles pause.

### 7.4 Motion & color

- All moving content has a `prefers-reduced-motion` fallback (§5.2).
- Color is never the **only** signal: every hue-coded status also has a text label or icon (e.g. `--err` tile always also has `<AlertCircle/>`).

---

## 8. MUST checklist

Every PR touching UI must satisfy these. This is a hard gate.

1. **Fonts loaded.** Inter, Instrument Serif, and JetBrains Mono are present via the `<link>` in `index.html` before first paint. No FOUT.
2. **Tokens only.** No hex outside `src/App.css :root` / `@theme`. No inline `style={{ color: '#...' }}` — dynamic color expressed via `--beat-hue` custom property + `oklch()`.
3. **Rounded corners.** `rounded-none` is banned outside deliberate separators (`<hr>`). Buttons use `rounded-xl`, cards `rounded-[18px]`, pills `rounded-full`.
4. **English-only UI chrome.** Newsletter output may be any language (per PRD §2); dashboard, auth, and Beat Designer copy are English. No Polish-first.
5. **Dark-only.** No `light:` modifier classes except inside `react-email` templates (§3.6).
6. **Beat = card.** Every beat renders as a `.beat-card` everywhere it appears (dashboard, dropdowns, email). Never a bare row.
7. **Hover lifts, not color-shifts.** Hover-only color changes on cards are forbidden — always combine with the lift transform.
8. **Per-beat hue respected.** If a row/card/page represents a specific beat, its hue drives the icon tile, the glow, and the accent. No hardcoded `--violet` etc.
9. **Accessibility pass.** Every interactive element has a focus ring, a reduced-motion path, and a non-color label for status.
10. **Grain + orbs on every dark full-page surface.** See §2.7 + §4. Missing grain = flat = rejected.

Before merging, paste the checklist result into the PR body.

---

## 9. Forbidden patterns

- **Mythic / Legendary / Epic / Rare rarities.** Those were exploration; PRD locks in `brief / standard / deep`.
- **Amber hex `#FBBF07`** or any yellow solid. Replaced by `oklch(0.72 0.18 48)`.
- **Flat hex colors** outside `App.css :root`.
- **`rounded-none`** outside `<hr>`.
- **Light mode** anywhere in MVP.
- **Polish-first copy** in UI chrome.
- **Emoji in UI chrome.** Emojis in newsletter item bodies from sources are OK to preserve.
- **Hand-drawn portraits / mascots / illustrations.** Use gradient tiles instead (Avatar pattern from shared.jsx).
- **Mythic gradient stacks / neon drop shadows** — the bundle's "legendary" aura. Our aura is a single-hue radial, nothing more.
- **Card hover that moves neighbors by default.** Only the dashboard "featured" view uses the dim-neighbors pattern; default grid hover is **self-only**.
- **MD-filled marketing icons.** Lucide stroke only.

---

## 10. Examples

### 10.1 Beat card (dashboard grid)

```tsx
<article
  className="beat-card relative flex flex-col gap-3.5 rounded-[18px]
             bg-[var(--bg-card)] border border-[var(--line)] p-[18px]
             isolation-isolate transition-all duration-300 ease-out
             hover:-translate-y-1.5 hover:border-[var(--line-strong)]
             hover:shadow-[var(--shadow-lifted)]"
  style={{
    ['--card-aura' as any]:
      `radial-gradient(80% 100% at 50% 0%, oklch(0.70 0.18 ${beat.hue} / 0.35), transparent 60%)`
  }}>
  {/* ::before renders the --card-aura (handled via @utility) */}
  <header className="flex items-start gap-3">
    <div className="h-11 w-11 rounded-xl flex items-center justify-center text-white shrink-0"
         style={{
           background: `radial-gradient(circle at 30% 30%, oklch(0.85 0.18 ${beat.hue}), oklch(0.45 0.22 ${(beat.hue+40)%360}))`,
           boxShadow: `0 8px 20px oklch(0.55 0.22 ${beat.hue} / 0.4), inset 0 1px 0 rgba(255,255,255,0.25)`
         }}>
      <Mail size={22}/>
    </div>
    <div className="flex-1 min-w-0">
      <span className={`depth-badge depth-${beat.depth}`}>{beat.depth}</span>
      <h3 className="mt-1 font-semibold text-[15px] tracking-[-0.01em] text-[var(--ink)]">{beat.name}</h3>
      <p className="mt-1 text-[11px] leading-[1.4] text-[var(--ink-dim)]">{beat.tagline}</p>
    </div>
  </header>

  <div className="flex gap-3.5 text-[10px] font-mono font-medium text-[var(--ink-dim)] tracking-wide">
    <span className="inline-flex items-center gap-1.5"><Clock size={11}/>{beat.cadence}</span>
    <span className="inline-flex items-center gap-1.5 text-[var(--ok)]"><Bolt size={11}/>next in {beat.nextIn}</span>
  </div>

  <div>
    <div className="mb-2 text-[9px] font-mono text-[var(--ink-faint)] tracking-[0.1em]">SOURCES · {beat.sources.length}</div>
    <div className="flex flex-wrap gap-1.5">
      {beat.sources.map(s => <SourceChip key={s.id} kind={s.kind} name={s.name}/>)}
    </div>
  </div>

  <div className="flex gap-2 mt-auto">
    <button className="btn-primary flex-1"><Bolt size={12}/>Run now</button>
    <button className="btn-ghost">View issues</button>
  </div>
</article>
```

### 10.2 Beat-creation chat shell (initial palette state)

```tsx
<section className="chat-shell mx-auto flex flex-col rounded-[18px]
                    bg-[rgba(20,20,26,0.95)] border border-[var(--line-strong)]
                    backdrop-blur-xl shadow-[var(--shadow-hero)]">
  <div className="flex items-center gap-3.5 px-6 py-5 border-b border-[var(--line)]">
    <Sparkle size={18} className="text-[var(--ink-faint)]"/>
    <input
      placeholder="Describe what you want Claude to cover…"
      className="flex-1 bg-transparent outline-none text-[var(--ink)]
                 text-[22px] leading-none tracking-[-0.01em] placeholder:text-[var(--ink-faint)]"/>
    <kbd className="font-mono text-[10px] text-[var(--ink-faint)]
                   px-1.5 py-1 border border-[var(--line)] rounded-[5px]">⏎</kbd>
  </div>
  <footer className="flex justify-between px-5 py-3 border-t border-[var(--line)]
                     font-mono text-[11px] text-[var(--ink-faint)]">
    <span>↓↑ navigate · ⏎ send · esc cancel</span>
    <PNLogo size={14}/>
  </footer>
</section>
```

### 10.3 Issue item row

```tsx
<li className="flex gap-4 py-4 border-t border-[var(--line)] first:border-0">
  <div className="w-1 self-stretch rounded-full"
       style={{ background: `oklch(0.70 0.18 ${beat.hue})` }}/>
  <img src={item.favicon} alt="" className="h-6 w-6 rounded-md mt-0.5"/>
  <div className="flex-1 min-w-0">
    <h4 className="font-semibold text-[15px] text-[var(--ink)] leading-snug">{item.headline}</h4>
    <p className="mt-1 text-[13px] text-[var(--ink-dim)] leading-[1.55]">{item.summary}</p>
    <div className="mt-2 flex flex-wrap gap-1.5">
      {item.sources.map(s => <SourceChip key={s.id} kind={s.kind} name={s.name}/>)}
    </div>
  </div>
  <div className="flex flex-col gap-1 shrink-0">
    <button aria-label="useful"   className="btn-ghost p-2"><ThumbsUp size={14}/></button>
    <button aria-label="not useful" className="btn-ghost p-2"><ThumbsDown size={14}/></button>
  </div>
</li>
```

---

## 11. Sources & handoff

- **Primary design source:** ClaudeOS v2 bundle extracted from `claude.ai/design` URL (2026-04-23). Local cache during hackathon: `/tmp/design-bundle/claudeos/project/`. Read this directly if you need pixel reference — especially `ClaudeOS v2.html` (tokens) and the three `v2-*.jsx` components (surface layouts).
- **Prototype stack vs production stack.** Prototype ships inline `<style>` + UMD React + Babel-standalone. **Do not port 1:1.** Translate tokens to Tailwind v4 `@theme` in `src/App.css`, translate shared primitives to React 19 components under `src/shared/components/`, and satisfy the §8 checklist instead of replicating the DOM.
- **Design evolution**: ClaudeOS was exploring a general AI OS; Personal Newsroom is one concrete product. Renames in §3 are binding — don't re-introduce `bundle / persona / ingredient / tier` terminology.
- **When in doubt**: open the bundle's `v2-bundles.jsx` (hover-row variant) and `v2-interview.jsx` (timeline variant) — those are the chat-recommended picks for dashboard and creation surface respectively.

*Last updated:* 2026-04-24.
