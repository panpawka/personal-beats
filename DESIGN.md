# DESIGN.md — Personal Newsroom

Binding design contract for `personal-beat`. The product is an **editorial
newsroom** the user runs. Chrome and content share tokens. If this file
conflicts with code, fix the code — not the spec.

Status: **active** (Phase 13 — Merged reference, 2026-04-25 onward).
Source of truth: Claude Design handoff bundle "Personal Beats — Merged.html"
(cached at `/tmp/personal-beats-design/personal-beats/`). Newsroom design
*system* (palette + class names in `styles.css`) carries over wholesale; the
*layout* + *type defaults* come from Merged.

Supersedes: Phase 12 (sans-on-serif inversion + 240px rail). Earlier
amber-brutalist spec retired long ago.

---

## 1. Product thesis

A beat is a topic a personal reporter covers. The app's artifact IS an email
newsletter. Chrome — icon rail, masthead, type — extends the artifact rather
than containing it. A user opens the app to read their paper, not to check a
dashboard.

Every surface obeys three questions:

1. **Place** — where in the newsroom am I? (rail + masthead answer this)
2. **Story** — what's on the page? (sans h1 with serif-italic accent word)
3. **Next** — what's the one action? (one primary button, never ambiguous)

If any surface fails these, redesign.

---

## 2. Tokens

All tokens live in `src/App.css` as plain CSS variables on `:root`. No
`@theme` — editorial tokens do not participate in Tailwind's design token
system; they are consumed by editorial class names. Tailwind utilities stay
available for auth pages and shadcn forms.

### Color (OKLCH)

| Token | Paper (default) | Sepia | Ink (dark) |
|-------|-----------------|-------|------------|
| `--paper`   | 0.985 0.006 75 | 0.96 0.025 70 | 0.18 0.012 70 |
| `--paper-2` | 0.965 0.008 75 | 0.94 0.03 70  | 0.21 0.014 70 |
| `--paper-3` | 0.94 0.01 75   | 0.91 0.035 68 | 0.25 0.014 70 |
| `--ink`     | 0.22 0.012 70  | 0.28 0.04 50  | 0.94 0.006 75 |
| `--ink-2`   | 0.36 0.01 70   | 0.42 0.03 55  | 0.78 0.008 75 |
| `--ink-3`   | 0.52 0.008 70  | 0.55 0.025 55 | 0.62 0.008 75 |
| `--ink-4`   | 0.68 0.006 70  | 0.68 0.02 60  | 0.5 0.008 75  |
| `--accent`  | `#c83a2c` (signal red) — same across all themes               |
| `--thumbs-up`   | oklch(0.55 0.12 145) — green for positive feedback        |
| `--thumbs-down` | oklch(0.55 0.16 30) — accent-shifted red for negative     |

`--rule` and `--rule-strong` are alpha-mixed ink (per theme). Never use raw
grey fills for dividers — they break under theme switch.

Theme is set via `<html data-theme="paper|sepia|ink">` by the
`ThemeProvider` at `src/lib/theme.tsx`. Persisted to `localStorage` key
`pb.theme` with try/catch rescue. **On first load, the provider auto-picks
`ink` if `prefers-color-scheme: dark` and no stored preference exists**;
otherwise `paper`.

### Type

- Serif: **Source Serif 4** — accent type only (see rules below)
- Sans: **Geist** — primary UI, headings, body
- Mono: **JetBrains Mono** — eyebrows, metadata, kbd, badges, dates

Loaded once via Google Fonts in `main.wasp` head.

**Rule — sans is default. Serif is reserved.** Apply serif (italic, weight
400) ONLY to:

1. The masthead wordmark (`Personal Beats`, with the leading word emphasised
   in bold-italic accent).
2. Page-heading h1s' italic accent spans (`<em>` / `<b>`) — coloured
   `--accent`. The surrounding h1 stays sans.
3. The Brief card title (designer summary).
4. Newsletter masthead title's accent word.
5. Dashboard greet (`Today, <em>Maja</em>`).

Everything else — body, deck/sub copy, button labels, form fields, chat
turns, beat-card titles, story h2s — uses sans. The `serif-everywhere`
toggle in the Tweaks panel can override globally for testing.

Scale (defined as classes in `src/App.css`):

| Class | Usage |
|-------|-------|
| `.h-display` 64px serif | (legacy — retired in Merged; do not use)         |
| `.h-1` 42–56px sans     | landing/page hero (with serif italic accent span) |
| `.h-2` 28–38px sans     | section heads, dashboard greet (greet uses serif italic) |
| `.h-3` 19–22px sans     | card titles, story h2 in newsletter             |
| `.lede` 16px sans       | hero sub, deck                                  |
| `.pb-body` 14.5–16px sans | long-form copy in newsletter, beat pitch      |
| `.eyebrow` 10.5px sans uppercase | section eyebrow                       |
| `.eyebrow-mono` 10.5px mono uppercase | metadata eyebrow                  |
| `.ui-s/.ui-xs`          | micro-copy                                       |

Headings use letter-spacing −0.012em to −0.025em depending on size; never
positive tracking.

### Density

`<html data-density="compact|regular|comfy">` sets `--density-y/-x`. Cards
and chat rows consume these vars. Default `regular`. Compact reduces base
font-size to 13.5px on `body`.

### Shape / rule / shadow

- `--hairline: 0.5px` — hairlines only, no 1px borders anywhere in editorial
  content. Exception: `border-bottom: 1.5px double var(--ink)` on
  newsletter/email-mast dividers and the masthead sub-strip; `border-bottom:
  2px solid var(--ink)` on email-foot.
- `--shadow-card` — reserved for the **brief-card**, **email-window**, and
  the sticky **composer**. Nothing else gets a shadow.
- Border-radius: **0** by default — editorial blocks are rectilinear. 4px
  for theme-toggle / pills, 6px for buttons, 10px max for the brief-card.
  Anything > 10px is anti-pattern.

---

## 3. Layout

### Shell

Authenticated routes render inside `<AppShell>` (`src/layout/AppShell.tsx`):

```
┌──────┬───────────────────────────────────────────────┐
│ Rail │  Masthead (sticky, backdrop-blur)              │
│ 80px ├───────────────────────────────────────────────┤
│      │  Mast-sub strip · double-rule bottom           │
│      ├───────────────────────────────────────────────┤
│      │  content                                        │
└──────┴───────────────────────────────────────────────┘
```

- `LandingPage` (`/`) renders inside the shell — hero replaces the content
  block, masthead is still the same sticky masthead.
- Auth pages (login/signup/reset) stay on Tailwind — lowest priority to
  convert; acceptable temporary mismatch.

### Rail (`src/layout/Rail.tsx`) — 80px icon column

Vertical strip, sticky, hairline right border. Top to bottom:

1. **Brand mark** — 38×38 ink square, serif italic "P", accent dot top-right.
   Click → home (or dashboard if signed-in).
2. **Tabs** — five icon+label tiles (`Home ◇`, `Today ◧`, `New ✎`, `Beat ▤`,
   `Issue ✉`). Each tile: glyph 18px, then mono uppercase label 9.5px.
   Active state: ink-tinted background fill (no left bar). Hover: same fill
   at lower alpha. `data-active="true"` on the matching route.
3. **Spacer** — pushes user/auth tile to bottom.
4. **You** — 36px round avatar (signal-red bg, paper initial). Hover-title
   shows email + "click to sign out". Unauthed shows a Login tab in its
   place.

No section labels, no badges, no per-beat list — that affordance moved to
the dashboard.

### Masthead (`src/layout/Masthead.tsx`)

Three-column grid `1fr · auto · 1fr`, sticky, hairline bottom, backdrop-blur
8px. `paddings: 26px 56px 16px`.

- **Left** — mono uppercase folio (`Vol. III · No. 124`)
- **Center** — serif italic wordmark, 38px, `<b>Personal</b> Beats` with the
  bold word in `--accent`. Single line, baseline-aligned with the folio.
- **Right** — flex row: mono date (`Friday · Apr 24, 2026`), then the
  always-visible **theme toggle** (paper / ink, 2-button segmented control).
  Sepia is reachable via the Tweaks panel only.

Below the masthead: a `mast-sub` strip with three slots (section name ·
ambient line e.g. weather · user email), mono uppercase, terminated by a
double-rule (`1.5px double var(--ink)`).

---

## 4. Component surfaces

### Landing (`/`) — centered hero

`<section class="hero">` fills the viewport below the masthead.

- Mono kicker with hairline flanges either side (`— A personal newsroom,
  yours alone —`).
- h1 sans, 56px, weight 500, with italic serif accent span(s):
  `What should <em>we</em> be reading / for <em>you</em>?` — two-line break.
- Sub paragraph 16px sans, 560px max.
- **Hero input** — 720px wide, hairline ink border, `paper` bg. Single-line
  text field on the left, ink "Begin →" button on the right. On focus the
  border tints `--accent` with a 3px accent-soft halo. The button flips to
  `--accent` once the input has any non-empty value.
- **Starter chips** below — six rectangular chips (`Wrocław weekends with
  the kids`, etc.). Click seeds the designer.
- **Hero foot** — hairline-top row inside the same 720px column with three
  mono slots: founding line · reassurance copy · "Go to today's edition →"
  link.

No dashboard cards on landing. That's the point — the input is the star.

### Dashboard (`/dashboard`) — Today

`<section class="dash">`, padding `36px 56px 80px`.

1. **Greet header** — serif italic 38px h2 (`Today, <em>Maja</em>`) plus a
   mono meta line on the right. Hairline bottom.
2. **Stats strip** — four equal columns separated by hairlines: numeric value
   in serif 30px, mono label in 10px uppercase. Hairline bottom.
3. **Working block** (`.dash-working`) — single hairline card on `paper-2`
   showing what the agent is currently doing. Pulsing accent dot
   (`@keyframes pulseRing` 1.8s, scale 1→2.6, opacity 0.5→0). Mono "Now
   running" label, sans 15px headline, sans 12.5px sub, ghost button on the
   right.
4. **Beats grid** — asymmetric `2fr 1fr 1fr` grid with hairline cell borders.
   The lead card spans the first two columns and uses serif italic for its
   title (26px); the rest use sans (19px) titles. Each card: mono meta row
   (cadence · live/planned dot · issue count) → title → pitch → optional
   signal-bars row → dashed-rule foot with arrow link.
5. **Add tile** (`.dash-add`) — dashed border block: serif italic prompt
   (`Track <em>something else</em>?`) on the left, suggest-chip cluster on
   the right. Click any chip → designer with seed.

Empty state: replace grid with a single editorial CTA card; use the same
hero pattern (mono kicker → serif h1 with accent span → lede → primary).

### Beat Designer (`/beats/new`, `/beats/:id` while pre-active)

Single column, max-width **760px**, padding `44px 40px 120px`. No spec-card
panel — the Brief card appears at the END of the conversation, in-flow.

- **Designer head** — small mono label (`The designer · A short
  conversation`), then sans 36px h1 with italic accent span, then sub.
- **Turns** — `30px / 1fr` grid per row. Avatar = round 30px circle (signal
  for user, ink for editor). Bubble is plain sans 15px text — no chrome, no
  background. Editor's italic accent words use serif italic in `--accent`.
- **Inline rule chips** — between turns when the parser detects a new rule,
  a `.rules-inline` row appears: mono label `understood so far` + chips with
  mono key (`CADENCE`) and sans value (`Every Friday · 5 pm`). Border:
  `oklch(0.58 0.18 25 / 0.4)`, fill `0.06`. Animates in (260ms fadeIn).
- **Suggest row** — under the agent's question, optional `or pick one:`
  chips. Click adopts and replies for you.
- **Sticky composer** at `bottom: 18px` — hairline ink border (focus tints
  to `--accent`), auto-growing textarea + "Send" button on the right.
  `--shadow-card` underneath. Cmd-Enter submits.
- **Brief card** — appears once the editor has confirmation. Hairline ink
  border, double-rule head, accent mono `THE BRIEF` label and vol/issue. Body
  has an italic-serif `--accent` h3 (the beat title), then a key/value table
  (sans values, mono keys). Foot: ghost "Keep refining" + primary "Save
  beat".

### Beat Detail (ACTIVE/PAUSED beats)

- **Beat hero** (`.b-hero`) — full-width `36px 56px 22px`, terminated by a
  double-rule. Mono meta row (live dot · cadence · "№ 14 issues delivered").
  Sans h1 44px with italic accent span(s) for the topic. Pitch in sans
  15.5px, max 700px. Action row underneath: primary "Run now" + ghost
  "Settings".
- **Two-column body** (`.twocol`) — `1.6fr 1fr` columns with 56px gap, padding
  `36px 56px 80px`. Each column starts with a sans uppercase h3 over a
  hairline.
  - Left column: **Past issues** — `50px / 1fr / auto` grid rows with mono
    `№ 14`, sans 16px headline + sub, mono date + vote counts (`▲8 ▼1`,
    up coloured `--thumbs-up`, down coloured `--accent`). Hover indents 6px.
  - Right column: **Side blocks**:
    - `Next run` card on `paper-2`, hairline, 8px radius, mono time.
    - `What I've learned` (`learned`) — dashed-rule rows with `+` / `−`
      sign coloured up/down, sans rule body.
    - `Sources used` — chip cluster (mono 10.5px, hairline border).

### Issue (newsletter / email reader)

`<section class="reader">` padding `36px 56px 80px`. Inside, a `.mail-wrap`
720px wide with hairline border and `paper` background.

- **Email mast** centered: mono small-caps row (top folio + date), sans h1
  34px with italic-serif accent word in `--accent`, italic sans deck below,
  then a double-rule `Vol. III · No. 124 · Apr 24, 2026` strip.
- **TL;DR** strip on `paper-2` with mono accent label.
- **Weather strip** — three mono columns (weather, kid-fit, dress).
- **Stories** — sans h2 22px (no italic accent in headlines), category
  eyebrow above each, sans body, dashed-rule foot containing inline source
  citations (mono chips) and per-story thumbs (see §7). Stories separated by
  hairlines; first story has no top rule.
- **In brief** — double-rule top, sans h3 14px uppercase, then `80px / 1fr /
  auto` grid rows.
- **Foot** on `paper-3`-tinted `paper`, double-rule top, mono uppercase
  centred.

---

## 5. Motion

- Hover: background tween 120–160ms, no transforms (except issue-row 6px
  indent on hover and brand-mark 1.04 scale).
- Confidence/progress bar fill: 480ms cubic-bezier(.2,.7,.2,1).
- Pulse ring on the working block: 1.8s ease-out infinite.
- Brief-card and rules-inline use 260–380ms fadeIn (translateY 3px → 0).
- No springs, no parallax. Paper does not bounce.

---

## 6. States

Every data surface must define:

- **Loading** — mono uppercase "Loading …" on hairline-spaced row. No
  spinners. No skeletons with rounded corners.
- **Empty** — an eyebrow + sans h1 with italic accent + lede + primary CTA.
  Treat it as an editorial page, not a modal-in-disguise.
- **Error** — `.editorial-error` (paper-red-tinted, left accent bar, sans
  body). Never toast. Never alert.

---

## 7. Feedback (un-retired in Merged)

Feedback thumbs are **back**, scoped to two surfaces:

1. **Newsletter stories** — per-story `▲ / ▼` buttons in the story-foot, 30px
   square, hairline border. Active states use `--thumbs-up` / `--thumbs-down`
   tinted backgrounds.
2. **Beat-detail issue archive** — read-only summary chips
   (`▲8 ▼1`) on each row. No interaction here; this is just the count.

The `submitItemFeedback` action and `feedbackMagicLink` endpoint are live
again. The "What I've learned" side block consumes the resulting rules.

**Demo risk** — Gmail / Microsoft Safe Links pre-fetch the magic links and
auto-record POSITIVE before the user reads. Mitigations live in
`tasks/feedback-prefetcher.md`. Do not expose un-confirmed thumbs over GET.

---

## 8. MUST checklist

Before marking any UI task done, verify:

1. No Tailwind utility classes in editorial surfaces (`AppShell`-wrapped
   pages). Only `.pb-*` and editorial class names. Auth pages exempt.
2. Sans is default; serif appears only in the five contexts named in §2.2.
3. No emojis in copy. `--accent` is the only non-ink colour in the type
   stack (and `--thumbs-up` solely for the up-thumb).
4. `⌘↵` and `⌘N` rendered as `<span class="kbd">…</span>` everywhere.
5. All dividers use `--rule` or `--rule-strong`, never raw grey. The double-
   rule (`1.5px double var(--ink)`) is reserved for masthead-sub, beat-hero
   bottom, and email-mast / email-foot.
6. Every screen works under all three themes (paper/sepia/ink) and the in-
   masthead toggle covers paper↔ink. Contrast stays ≥ 3:1 for dividers,
   ≥ 4.5:1 for body text.
7. Loading, empty, and error states all implemented per §6.
8. No `alert()` or `confirm()` for destructive actions on shipped screens —
   inline confirmation only. (Interim: `deleteBeat` still uses `confirm()`;
   replace before v1 GA.)
9. The deliverable reads like a newsroom. If it reads like a dashboard,
   you are not done.

---

## 9. Anti-patterns

Hard "no" list. If reviewers see these, revert:

- Amber / yellow accent (retired brand)
- Border-radius > 10px on any editorial element
- Polish-language UI copy (retired project; demo data may still be Polish)
- ShadCN cards inside the `.app` shell
- Gradients, glassmorphism, neon
- Icons at 24px+ (editorial icons are 13–16px; rail glyphs 18px)
- Serif h1 / h2 outside the five permitted contexts (§2.2)
- 1px solid borders inside editorial content (use the hairline)
- Toasts / alert() / confirm() / browser dialogs

---

## 10. Deferred (TODOs.md candidates)

- Keyboard shortcuts (⌘N, g-d)
- Reader-mode standalone issue route
- Per-beat accent override
- Rail expand-on-hover with secondary labels
- Tweaks panel (live theme/density controls + sepia toggle) — dev-only
- Confetti on first issue delivery
- Email-frame PDF export
- Real-time SSE for designer (polling works at demo scale)
- Feedback-prefetcher mitigation (POST-only confirm step) — see §7
