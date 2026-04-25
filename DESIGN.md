# DESIGN.md — Personal Newsroom

Binding design contract for `personal-beat`. The product is an **editorial
newsroom** the user runs. Chrome and content share tokens. If this file
conflicts with code, fix the code — not the spec.

Status: **active** (Phase 12 rewrite, 2026-04-24 onward).
Supersedes: prior amber-brutalist spec (retired).

---

## 1. Product thesis

A beat is a topic a personal reporter covers. The app's artifact IS an email
newsletter. The chrome — rail, masthead, serif type — extends the artifact
rather than containing it. A user opens the app to read their paper, not to
check a dashboard.

Every surface obeys three questions:

1. **Place** — where in the newsroom am I? (rail + masthead answer this)
2. **Story** — what's on the page? (serif display type + lede)
3. **Next** — what's the one action? (primary button, never ambiguous)

If any surface fails these, redesign.

---

## 2. Tokens

All tokens live in `src/App.css` as plain CSS variables on `:root`. No
`@theme` — editorial tokens do not participate in Tailwind's design token
system; they are consumed by editorial class names. Tailwind utilities stay
available for auth pages and shadcn forms.

### Color (OKLCH)

| Token | Paper (default) | Sepia | Ink |
|-------|-----------------|-------|-----|
| `--paper`   | 0.985 0.006 75 | 0.96 0.025 70 | 0.18 0.012 70 |
| `--paper-2` | 0.965 0.008 75 | 0.94 0.03 70  | 0.21 0.014 70 |
| `--paper-3` | 0.94 0.01 75   | 0.91 0.035 68 | 0.25 0.014 70 |
| `--ink`     | 0.22 0.012 70  | 0.28 0.04 50  | 0.94 0.006 75 |
| `--ink-2`   | 0.36 0.01 70   | 0.42 0.03 55  | 0.78 0.008 75 |
| `--ink-3`   | 0.52 0.008 70  | 0.55 0.025 55 | 0.62 0.008 75 |
| `--ink-4`   | 0.68 0.006 70  | 0.68 0.02 60  | 0.5 0.008 75  |
| `--accent`  | #c83a2c (red ochre) across all themes                    |

**Rule contrast:** `--rule` and `--rule-strong` are alpha-mixed ink. Never
use raw grey fills for dividers — they break under theme switch.

Theme is set via `<html data-theme="paper|sepia|ink">` by the
`ThemeProvider` at `src/lib/theme.tsx`. Persisted to `localStorage` key
`pb.theme` with try/catch rescue.

### Type

- Serif: **Source Serif 4** (primary display + body)
- Sans: **Geist** (UI, buttons)
- Mono: **JetBrains Mono** (eyebrows, metadata, kbd, badges)

Loaded once via Google Fonts in `main.wasp` head.

Scale (all defined as classes in `src/App.css`):

| Class | Usage |
|-------|-------|
| `.h-display` 64px serif | landing hero |
| `.h-1` 42px serif       | page title (designer step-one, empty dashboard) |
| `.h-2` 28px serif       | section heads (past issues, sources used) |
| `.h-3` 20px serif       | card titles |
| `.lede` 19px serif      | under-display paragraphs |
| `.pb-body` 16px serif   | long-form |
| `.eyebrow` 10.5px sans uppercase | section eyebrow |
| `.eyebrow-mono` 10.5px mono      | metadata eyebrow |
| `.ui-s/.ui-xs`                   | micro-copy |

Never mix `h-display` with dashboard content; reserve for landing and
beat-hero h1. Downshift one step if a screen feels loud.

### Density

`<html data-density="compact|regular|comfy">` sets `--density-y/-x`. Cards
and chat rows consume these vars. Default `regular`.

### Shape / rule / shadow

- `--hairline: 0.5px` — hairlines only, no 1px borders anywhere in editorial
  content. Exception: primary button has no border of its own (color does
  the work).
- `--shadow-card` — reserved for the **spec-card** and **email-window**.
  Nothing else gets a shadow.
- Border-radius: 4px (pills), 6px (buttons, chips), 8–10px (large cards).

---

## 3. Layout

### Shell

Authenticated routes render inside `<AppShell>` (`src/layout/AppShell.tsx`):

```
┌────────────┬───────────────────────────────────────────┐
│  Rail 240  │  Masthead (sticky, backdrop-blur)          │
│  sticky    ├───────────────────────────────────────────┤
│            │  content                                    │
└────────────┴───────────────────────────────────────────┘
```

- `LandingPage` renders outside the shell (own editorial header/footer).
- Auth pages (login/signup/reset) stay on Tailwind — lowest priority to
  convert; acceptable temporary mismatch.

### Rail (`src/layout/Rail.tsx`)

Four sections, top to bottom:

1. **Brand** — PB mark + accent dot + Serif wordmark + mono "est. 2026".
2. **Workspace** — "All beats", "New beat" (⌘N hint).
3. **Your beats** — reactive list from `getBeats`. Status dot (live/paused),
   truncated title, `№NNN` badge. On query error: "—" placeholder.
4. **Inbox** — "Latest delivery" + time-ago badge.

Foot: user avatar + email + plan line + theme cycle button + sign-out.

Active state is a 2px accent bar on the left of the active link. Links
never scale or shift on hover.

### Masthead (`src/layout/Masthead.tsx`)

Prop-driven; each page supplies its own. Sticky, hairline bottom,
backdrop-blur 8px. `{ title?, right?, showDate? }`.

---

## 4. Component surfaces

### Dashboard

Stats strip (4 stats, serif values) + `beat-grid` (2-col hairline grid) +
`NewBeatCard` tile + suggested-briefs chip row. Empty state replaces grid
with single editorial CTA.

### Beat Designer (non-terminal statuses)

Two-column: chat-stream left (1.4fr) + spec-card right (1fr) on `paper-2`
with dot-pattern background. Spec-card fills live as the designer writes.
Clarification reply is a single composer at the bottom; keyboard `⌘↵`.

### Beat Detail (ACTIVE/PAUSED)

`beat-hero` (1fr / 320px). Left = hero copy; right = next-run card + kv
rows. Below: past-issues table (5-col grid) + sources-used box.

### Issue (email-frame)

Outer frame on `paper-3` with heavy shadow, inner `email-window` max 640px.
Masthead with 2px ink rule. Stories separated by hairlines. No feedback
thumbs (retired — §7).

---

## 5. Motion

- Hover: background tween 120–140ms, no transforms.
- Confidence bar fill: 480ms cubic-bezier(.2,.7,.2,1).
- No springs, no parallax. Paper does not bounce.

---

## 6. States

Every data surface must define:

- **Loading** — mono uppercase "Loading …" on hairline-spaced row. No
  spinners. No skeletons with rounded corners.
- **Empty** — an eyebrow + serif headline + lede + primary CTA. Treat it
  as an editorial page, not a modal-in-disguise.
- **Error** — `.editorial-error` (paper-red-tinted, left accent bar,
  serif body). Never toast. Never alert.

---

## 7. Scope reductions

The **feedback feature is retired** (thumbs-up/thumbs-down on issue
items). The backend columns and the `feedbackMagicLink` endpoint remain for
follow-up cleanup, but no new UI uses them. Do not add `submitItemFeedback`
calls. Do not extend queries with feedback aggregates. The "Learned rules"
box on BeatDetail is removed.

---

## 8. MUST checklist

Before marking any UI task done, verify:

1. No Tailwind utility classes in editorial surfaces (`AppShell`-wrapped
   pages). Only `.pb-*` and editorial class names. Auth pages exempt.
2. No emojis in copy. Accent is the only non-ink color in the type stack.
3. `⌘↵` and `⌘N` rendered as `<span class="kbd">…</span>` everywhere.
4. All dividers use `--rule` or `--rule-strong`, never raw grey.
5. Every screen works under all three themes (paper/sepia/ink). Contrast
   stays ≥ 3:1 for dividers, ≥ 4.5:1 for body text.
6. Loading, empty, and error states all implemented per §6.
7. No `alert()` or `confirm()` for destructive actions on shipped screens —
   inline confirmation only. (Interim: `deleteBeat` still uses `confirm()`;
   replace before v1 GA.)
8. The deliverable reads like a newsroom. If it reads like a dashboard,
   you are not done.

---

## 9. Anti-patterns

Hard "no" list. If reviewers see these, revert:

- Amber / yellow accent (retired brand)
- `rounded-none` on anything editorial
- Polish-language copy (retired project)
- ShadCN cards inside the `.app` shell
- Gradients, glassmorphism, neon
- Icons at 24px+ (editorial icons are 13–16px)
- Sans-serif headings in content
- Border-radius > 10px

---

## 10. Deferred (TODOs.md candidates)

- Keyboard shortcuts (⌘N, g-d)
- Reader-mode standalone issue route
- Per-beat accent override
- Rail collapse to mono-icon
- Tweaks panel (live theme/density controls) — dev-only
- Confetti on first issue delivery
- Email-frame PDF export
- Real-time SSE for designer (polling works at demo scale)
