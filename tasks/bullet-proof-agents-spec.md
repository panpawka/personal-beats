# Bullet-proof agents — implementation spec

**Status:** For review. No code changes yet.
**Scope:** Tier 1 (prompt + schema hardening) + Tier 3 (external tool recipes).
**Skipped:** Tier 2 (critic+retry) — evaluate after T1/T3 land.
**Target files:** `src/server/agents/definitions.ts`, `scripts/provision-agents.ts`, new `.env.server` keys.

---

## 1. Root cause recap

Current scout returns same-domain sources because:
- No diversity constraint in prompt → Claude's web_search SEO bias wins.
- Only `agent_toolset_20260401` (web_search + web_fetch + bash). No specialized recipes.
- `scout_complete` accepts self-reported `coverage_assessment` with no domain-count validation.
- `global_patterns` seeds are generic English hints, not concrete recipes.
- No few-shot exemplars on any agent.

Editor shares the self-grading + missing-recipe gaps.

---

## 2. Changes — `src/server/agents/definitions.ts`

### 2.1 Sources Scout — system prompt additions

**Insert after "## Source categories to cover" block (between current lines 194-203):**

```md
## Domain-diversity constraint (HARD)

Your sources MUST span at least 6 distinct eTLD+1 domains (e.g. `nytimes.com`
and `blog.nytimes.com` count as ONE domain; `wroclaw.pl` and `um.wroclaw.pl`
count as ONE). If you cannot find 6 distinct domains after exhausting the
recipe catalog below, write what you have AND set `coverage_assessment`
to `"sparse"` and `distinct_domains` to the honest count. Never inflate.

Before writing `sources.yaml`, group your candidates by eTLD+1 and drop any
that would push a single domain past 3 entries while another domain has zero.
It is better to publish 8 sources spanning 8 domains than 20 sources from
3 domains.

## Recipe catalog (use these BEFORE generic web_search)

Your environment ships python3.12 + feedparser + beautifulsoup4 + requests +
playwright. Run the following recipes via `bash python -c "..."` or
`bash curl`. Prefer structured APIs over HTML scraping.

1. **Google News RSS (multi-language)** — zero-auth, primary discovery:
   `https://news.google.com/rss/search?q=<QUERY>&hl=<LANG>&gl=<COUNTRY>&ceid=<COUNTRY>:<LANG>`
   Example (Wrocław in Polish):
   `...?q=Wrocław&hl=pl&gl=PL&ceid=PL:pl`
   Parse with feedparser. Each item's `source` field gives you the publisher
   — that's a source candidate.

2. **Reddit JSON API** — zero-auth: `https://www.reddit.com/r/<SUB>/new.json`
   or `https://www.reddit.com/search.json?q=<QUERY>&sort=new`.
   Sub-discovery: `https://www.reddit.com/subreddits/search.json?q=<TOPIC>`.
   Note: must set a User-Agent header or you get 429.

3. **Hacker News (Algolia)** — zero-auth, tech-focused:
   `https://hn.algolia.com/api/v1/search?query=<Q>&tags=story`.
   For a live feed: `https://hnrss.org/newest?q=<Q>`.

4. **arXiv RSS** — research papers: `http://export.arxiv.org/rss/<category>`
   e.g. `cs.AI`, `cs.LG`. For search:
   `http://export.arxiv.org/api/query?search_query=<Q>`.

5. **Nitter RSS** — X/Twitter without auth. Use these mirror fallbacks
   in order (try each, the first that returns valid RSS wins):
   `https://nitter.net/<handle>/rss`
   `https://nitter.privacydev.net/<handle>/rss`
   `https://nitter.poast.org/<handle>/rss`
   If all fail, skip Twitter sources for this beat; don't block.

6. **YouTube channel RSS** — zero-auth:
   `https://www.youtube.com/feeds/videos.xml?channel_id=<CHANNEL_ID>`.
   Channel ID discoverable from the channel page source.

7. **GitHub Trending (HTML)** — for developer beats:
   `https://github.com/trending/<lang>?since=weekly` — parse with BS4.

8. **RSS autodiscovery** — for any press site:
   fetch the root HTML, grep for `<link rel="alternate" type="application/rss+xml">`
   or `type="application/atom+xml"`. Most press sites still publish feeds.

9. **Sitemap crawl** — for press sites without clear feeds:
   try `<site>/sitemap.xml`, `<site>/sitemap_news.xml`,
   `<site>/robots.txt` (lists sitemaps).

10. **Jina Reader** — clean markdown extraction from any article URL
    when BS4 struggles: `https://r.jina.ai/<URL>` returns readable
    markdown. Free, no key required.

11. **DuckDuckGo HTML search** — zero-auth fallback when Claude's
    web_search is biased: `https://html.duckduckgo.com/html/?q=<Q>`.

12. **Wikipedia REST** — for entity verification and finding official
    links: `https://<LANG>.wikipedia.org/api/rest_v1/page/summary/<TITLE>`.

13. **Tavily API** (only if TAVILY_API_KEY is in env — a
    dedicated_api_key tool will surface it). Agent-tuned search,
    1000 free/mo: `https://api.tavily.com/search` POST with
    `{"api_key": "...", "query": "...", "max_results": 10,
    "include_domains": []}`. Use this when you need a second-opinion
    search distinct from Claude's web_search.

14. **Playwright (JS-rendered sites)** — for Polish municipal sites
    and other SPAs: `bash python -c "from playwright.sync_api import
    sync_playwright; ..."`. Slow, use sparingly.

For each beat, pick the 3-5 recipes that fit the beat type. Local beats
lean on Google News RSS + Reddit + Nitter + sitemap + Playwright for
municipal. Topical/tech beats lean on HN + arXiv + GitHub trending +
Nitter + RSS autodiscovery. Record which recipes you used in
`scout_complete`.

## Golden example outputs (read these before drafting your own)

Your spec store contains a `/examples/` directory with two reference
outputs — one local beat (Wrocław kids activities), one topical
(AI agent frameworks). `bash ls /mnt/memory/<global-patterns-mount>/examples/`
then read both before writing. They show the target shape, depth of
`notes` field, category balance, and language handling.
```

### 2.2 Sources Scout — updated `scout_complete` tool schema

Replace current schema (definitions.ts:246-268) with:

```ts
{
  type: "custom",
  name: "scout_complete",
  description:
    "Signals that sources.yaml has been written to memory. Call this exactly once, as the final action.",
  input_schema: {
    type: "object",
    properties: {
      beat_slug: { type: "string" },
      source_count: { type: "integer" },
      distinct_domains: {
        type: "integer",
        description:
          "Count of distinct eTLD+1 domains represented across all sources. If this is < 5, coverage_assessment MUST be 'sparse'.",
      },
      categories_covered: {
        type: "array",
        items: {
          type: "string",
          enum: [
            "official",
            "press",
            "community",
            "aggregator",
            "primary_data",
            "expert",
          ],
        },
      },
      recipes_used: {
        type: "array",
        items: { type: "string" },
        description:
          "Names of recipes applied, e.g. ['google_news_rss', 'reddit_json', 'rss_autodiscovery'].",
      },
      coverage_assessment: {
        type: "string",
        enum: ["healthy", "thin", "sparse"],
      },
      thinness_reason: {
        type: "string",
        description:
          "Required when coverage_assessment is 'thin' or 'sparse'. One sentence on what's missing.",
      },
      notes: { type: "string" },
    },
    required: [
      "beat_slug",
      "source_count",
      "distinct_domains",
      "categories_covered",
      "recipes_used",
      "coverage_assessment",
      "notes",
    ],
  },
}
```

### 2.3 Wasp-side orchestrator — enforce threshold

In `src/server/jobs/generateIssue.ts` (or wherever `scout_complete` is
handled), after parsing the tool-call payload:

```ts
const MIN_DOMAINS = 5;
if (payload.distinct_domains < MIN_DOMAINS && payload.coverage_assessment === "healthy") {
  // Agent lied. Override.
  payload.coverage_assessment = "sparse";
  payload.thinness_reason = payload.thinness_reason
    ?? `Only ${payload.distinct_domains} distinct domains; below healthy threshold of ${MIN_DOMAINS}.`;
}
```

Retry logic (deferred to T2) would re-invoke with those notes injected.
For T1, just surface the accurate assessment in the Wasp DB so the UI
shows "sparse" instead of a false "healthy".

### 2.4 Editor — system prompt additions

Insert after step 2 (CLUSTER) in `EDITOR_SYSTEM`:

```md
### Cross-source requirement per cluster

For `depth = standard` and `depth = deep`, every cluster that survives
FILTER must be corroborated by at least 2 distinct-domain sources.
Clusters from a single domain are demoted below the fold and marked
with `single_source: true`. For `depth = brief`, a single source is
acceptable but prefer corroborated items when both exist.
```

Insert after step 5 (VERIFY):

```md
### Verification recipes

Same recipe catalog as Sources Scout applies. Specifically:
- Use **Wikipedia REST** to resolve entity names (people, places,
  organizations) before quoting them — catches "Springfield, MO vs IL"
  errors.
- Use **Jina Reader** when the primary source URL returns paywall
  markup to BS4.
- For claims about events with a date, cross-check against the
  official source's own calendar/feed when available.
```

### 2.5 Editor — `publish_issue` schema additions

Add to `items` object:

```ts
single_source: { type: "boolean" },
verification_notes: {
  type: "string",
  description:
    "One sentence: which recipe/URL was used to verify the primary claim. Required for depth=deep.",
},
```

No new required fields (so this is backward compatible with partial runs).

### 2.6 Beat Designer — minor prompt additions

Insert before "## Tone" block:

```md
## Output-language discipline

Write the `relevance.md` file in the beat's `output_language`, NOT in
English by default. A Polish beat gets Polish relevance rules. This
matters because Editor will match those rules against Polish content —
mismatched languages cause silent filter failures.
```

Beat Designer needs minimal changes. Its current logic (clarification
gate + default sensibly) is working well.

---

## 3. New files — seed the `global_patterns` store

Extend `GLOBAL_PATTERNS_SEEDS` in `scripts/provision-agents.ts:47-103`
with:

### 3.1 `/recipes/google_news_rss.md`

```md
# Google News RSS recipe

Zero-auth primary discovery for local AND topical beats.

## URL template
`https://news.google.com/rss/search?q=<QUERY>&hl=<LANG>&gl=<COUNTRY>&ceid=<COUNTRY>:<LANG>`

## Examples
- Wrocław news in Polish:
  `https://news.google.com/rss/search?q=Wroc%C5%82aw&hl=pl&gl=PL&ceid=PL:pl`
- AI agents in English:
  `https://news.google.com/rss/search?q=%22AI+agents%22&hl=en&gl=US&ceid=US:en`

## Python snippet
```python
import feedparser, urllib.parse
q = urllib.parse.quote("Wrocław")
url = f"https://news.google.com/rss/search?q={q}&hl=pl&gl=PL&ceid=PL:pl"
feed = feedparser.parse(url)
publishers = {e.source.title for e in feed.entries if hasattr(e, "source")}
```

## Gotcha
Google News aggregates — each `entry.source.title` is the actual
publisher domain. Use THOSE as your source candidates, not
`news.google.com` itself.
```

### 3.2 `/recipes/reddit_json.md`

```md
# Reddit JSON API recipe

Zero-auth (with User-Agent header), great for community signal.

## URL templates
- Subreddit feed: `https://www.reddit.com/r/<SUB>/new.json?limit=25`
- Search all: `https://www.reddit.com/search.json?q=<Q>&sort=new&limit=25`
- Find subs: `https://www.reddit.com/subreddits/search.json?q=<TOPIC>`

## Python snippet
```python
import requests
r = requests.get(
    "https://www.reddit.com/r/poland/new.json?limit=25",
    headers={"User-Agent": "PersonalNewsroom/0.1 by research-bot"},
    timeout=15,
)
r.raise_for_status()
posts = r.json()["data"]["children"]
```

## Gotchas
- Missing User-Agent → 429.
- Reddit's `.json` endpoint is officially public but has rate limits.
  Add retry with 30-60s backoff.
- Active subs change — verify `post_count_last_week > 5` before
  including as a source.
```

### 3.3 `/recipes/hackernews.md`

```md
# Hacker News recipe

Algolia-backed HN search. Free, no auth.

## URL templates
- Search: `https://hn.algolia.com/api/v1/search?query=<Q>&tags=story`
- By date: `https://hn.algolia.com/api/v1/search_by_date?query=<Q>&tags=story`
- Live RSS: `https://hnrss.org/newest?q=<Q>`

## Python snippet
```python
import requests
r = requests.get(
    "https://hn.algolia.com/api/v1/search",
    params={"query": "claude agents", "tags": "story"},
    timeout=15,
)
hits = r.json()["hits"]
```

Strong signal for developer tools, AI, startups, tech business beats.
```

### 3.4 `/recipes/nitter_twitter.md`

```md
# Nitter (X/Twitter) RSS recipe

Zero-auth X/Twitter content via Nitter mirrors. Use mirror fallback
chain because individual hosts go down.

## Mirror priority
1. `https://nitter.net/<handle>/rss`
2. `https://nitter.privacydev.net/<handle>/rss`
3. `https://nitter.poast.org/<handle>/rss`

## Python snippet
```python
import feedparser
mirrors = [
    "https://nitter.net",
    "https://nitter.privacydev.net",
    "https://nitter.poast.org",
]
for base in mirrors:
    feed = feedparser.parse(f"{base}/levelsio/rss")
    if feed.entries:
        break
else:
    feed = None  # all failed; skip Twitter sources
```

## Discovery
For a topic beat, find 3-5 canonical voices on X, then use Nitter
for each. For a local beat, look for the municipal account + 2-3
local journalists.
```

### 3.5 `/recipes/rss_autodiscovery.md`

```md
# RSS / Atom autodiscovery

Most press sites still publish feeds but bury the link.

## Python snippet
```python
import requests, re
from bs4 import BeautifulSoup
html = requests.get("https://example-news.com", timeout=15).text
soup = BeautifulSoup(html, "html.parser")
feeds = [
    link.get("href")
    for link in soup.find_all(
        "link",
        type=["application/rss+xml", "application/atom+xml"],
    )
]
# Fallback: try common paths
candidates = ["/feed", "/rss", "/feed.xml", "/atom.xml", "/rss.xml"]
```

Always try the `<link rel="alternate">` route first — it's
self-described. Only fall back to path-guessing.
```

### 3.6 `/recipes/jina_reader.md`

```md
# Jina Reader recipe

Clean markdown extraction from any article URL. Free, no key.

## URL template
`https://r.jina.ai/<URL>`

## Python snippet
```python
import requests
md = requests.get(
    "https://r.jina.ai/https://en.wikipedia.org/wiki/Wroc%C5%82aw",
    timeout=30,
).text
```

Use when:
- BS4 parsing returns paywall markup or login walls.
- You need headline+body+date from a press article and don't want
  to write per-site scraping logic.
- Editor is corroborating a claim and wants the canonical
  article text without noise.

Do NOT use for: RSS-bearing sites (RSS is cheaper and cleaner),
sites behind real auth.
```

### 3.7 `/recipes/tavily_search.md`

```md
# Tavily Search recipe (optional, requires TAVILY_API_KEY)

Agent-tuned search, 1000 free searches/month. Used as a
second-opinion to Claude's built-in web_search when that returns
SEO-biased results.

## Check availability
```python
import os
api_key = os.environ.get("TAVILY_API_KEY")
if not api_key:
    # Fall back to DuckDuckGo HTML or built-in web_search
    raise RuntimeError("Tavily not configured; use built-in search")
```

## Python snippet
```python
import requests
r = requests.post(
    "https://api.tavily.com/search",
    json={
        "api_key": api_key,
        "query": "Wrocław municipal council agendas",
        "max_results": 10,
        "search_depth": "advanced",
    },
    timeout=30,
)
results = r.json()["results"]
```

## When to prefer Tavily
- When Claude's web_search for a local beat returns mostly
  aggregators (SEO bias).
- When you need source-quality ranking (Tavily ranks primary sources
  higher by design).
```

### 3.8 `/recipes/duckduckgo_html.md`

```md
# DuckDuckGo HTML search recipe

Free, zero-auth fallback when Claude web_search is biased and
Tavily isn't configured.

## URL
`https://html.duckduckgo.com/html/?q=<QUERY>`

## Python snippet
```python
import requests
from bs4 import BeautifulSoup
r = requests.get(
    "https://html.duckduckgo.com/html/",
    params={"q": "Wrocław rada miasta"},
    headers={"User-Agent": "Mozilla/5.0 PersonalNewsroom/0.1"},
    timeout=15,
)
soup = BeautifulSoup(r.text, "html.parser")
results = [
    (a.get_text(), a.get("href"))
    for a in soup.select("a.result__a")
]
```
```

### 3.9 `/recipes/wikipedia_rest.md`

```md
# Wikipedia REST recipe (entity verification)

Editor's primary tool for checking "did I get this name/place right?"
Free, no auth, multi-language.

## URL template
`https://<LANG>.wikipedia.org/api/rest_v1/page/summary/<TITLE>`

## Python snippet
```python
import requests, urllib.parse
title = urllib.parse.quote("Wrocław")
r = requests.get(
    f"https://pl.wikipedia.org/api/rest_v1/page/summary/{title}",
    timeout=15,
)
data = r.json()
# data["title"], data["description"], data["extract"], data["content_urls"]
```

Use for: disambiguation ("Springfield"), verifying a
politician/company exists, canonicalizing place names before
geocoding.
```

### 3.10 `/recipes/youtube_rss.md`

```md
# YouTube channel RSS recipe

For beats that should include video content (creator beats,
educational, documentary-style).

## URL template
`https://www.youtube.com/feeds/videos.xml?channel_id=<CHANNEL_ID>`

## Finding a channel ID
Fetch `https://www.youtube.com/@<handle>`, grep for
`"channelId":"UC..."`. Or hit
`https://www.youtube.com/@<handle>/about` and parse.

## Python snippet
```python
import feedparser
feed = feedparser.parse(
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCsXVk37bltHxD1rDPwtNM8Q"
)
```
```

### 3.11 `/recipes/github_trending.md`

```md
# GitHub Trending recipe

For developer beats. No official API — HTML scrape.

## URL
`https://github.com/trending/<lang>?since=daily|weekly|monthly`

Example: `https://github.com/trending/python?since=weekly`

## Python snippet
```python
import requests
from bs4 import BeautifulSoup
html = requests.get(
    "https://github.com/trending/python?since=weekly",
    headers={"User-Agent": "Mozilla/5.0"},
    timeout=15,
).text
soup = BeautifulSoup(html, "html.parser")
for article in soup.select("article.Box-row"):
    repo = article.h2.a.get_text(strip=True).replace(" ", "")
    desc = (article.p.get_text(strip=True) if article.p else "")
```
```

### 3.12 `/recipes/arxiv.md`

```md
# arXiv recipe

Primary source for research-heavy beats (AI/ML, physics, economics).

## URL templates
- Category feed: `http://export.arxiv.org/rss/<CATEGORY>`
  e.g. `cs.AI`, `cs.LG`, `stat.ML`, `q-fin`.
- Search: `http://export.arxiv.org/api/query?search_query=<Q>&sortBy=submittedDate&sortOrder=descending&max_results=20`

## Python snippet
```python
import feedparser
feed = feedparser.parse("http://export.arxiv.org/rss/cs.AI")
```
```

### 3.13 `/examples/local_beat_sources.yaml` (golden)

A 12-source, 10-distinct-domain example for a hypothetical
"Wrocław kids weekend activities" beat. Publishes as a reference
the scout can read BEFORE drafting. Full YAML, realistic URLs, each
source annotated with which recipe found it.

### 3.14 `/examples/topical_beat_sources.yaml` (golden)

Same shape for "AI agent frameworks weekly" beat — HN, arXiv,
GitHub trending, Nitter, 2-3 indie newsletters, official company
blogs. ~15 sources across ~12 domains.

*(These two golden files are the single biggest quality lever. Write
them by hand — don't generate. They should look like what we want
the scout to produce.)*

---

## 4. Environment variables — `.env.server` additions

Optional keys. Agents gracefully degrade if absent.

```
# Tavily Search — 1000 free searches/month, agent-tuned ranking.
# Without this, scout/editor fall back to DuckDuckGo HTML + Claude's
# built-in web_search.
TAVILY_API_KEY=
```

No other paid tools. APIFY, x-tweet-fetcher, GetStream wrappers:
deferred. Free recipes (Google News RSS, Nitter, Jina, HN, Reddit,
Wikipedia, arXiv, YouTube RSS, DDG, GitHub trending) cover the
demonstrable surface area.

How Tavily gets into the CMA environment: use the `dedicated_api_key`
mechanism on the Environment config (see CMA docs §envs) so the key
is available as `$TAVILY_API_KEY` inside bash. Add it in
`scripts/provision-agents.ts` when creating the environment:

```ts
const env = await createEnvironment({
  name: "newsroom-shared",
  config: {
    type: "cloud",
    networking: { type: "unrestricted" },
    // NEW:
    dedicated_api_keys: process.env.TAVILY_API_KEY
      ? [{ name: "TAVILY_API_KEY", value: process.env.TAVILY_API_KEY }]
      : [],
  },
});
```

*(Verify the exact field name against current CMA API before
implementing — may be `secrets` or `env_vars`.)*

---

## 5. Re-provision plan

1. Land code + seed changes on a branch.
2. Run `npx tsx scripts/provision-agents.ts --force` to rebuild
   environment + agents + re-seed global_patterns.
3. New IDs written to `.env.server`.
4. Smoke test: create a beat "Wrocław kids activities weekends" and
   check `distinct_domains` ≥ 6 in the resulting sources.yaml.
5. If ≥ 6: merge. If < 6: read recipe_used in the scout_complete
   payload, figure out which recipes the agent ignored, tighten the
   prompt's recipe-selection heuristic, re-provision.

---

## 6. Explicitly deferred

- **APIFY** (facebook-events-scraper, google-news-scraper): skip.
  Google News RSS is free; Facebook events only matter for a narrow
  beat class. Revisit if a user creates an event-heavy local beat
  and the demo specifically needs it.
- **ythx-101/x-tweet-fetcher**: skip. Nitter RSS is free and doesn't
  need Node-in-Docker integration. Revisit if Nitter reliability
  drops.
- **GetStream ai-agent-tools-catalog**: read as inspiration only.
  Picks from their catalog worth adopting as recipes (all free):
  HackerNews, arXiv, Wikipedia, Tavily, DuckDuckGo, Jina, YouTube,
  Playwright — all already in the recipe catalog above. Their
  Cal.com/Slack/Jira tools are productivity-app integrations, not
  newsroom discovery — skip.
- **Weather tool**: wttr.in (`curl wttr.in/Wroclaw?format=j1`) is
  free and would add a recipe file; useful only for weather-aware
  beats. Add when needed.
- **Tier 2 critic + retry**: defer until T1 ships and we measure
  whether quality still wobbles. Likely unneeded once golden
  examples + diversity constraint are in place.

---

## 7. Changes NOT in this spec (explicitly out of scope)

- Schema/DB changes — current `schema.prisma` unaffected.
- Model swaps — Sonnet 4.6 workers + Haiku 4.5 coordinator stay.
- Feedback prefetcher work (separate concern, see memory).
- Multi-user memory / per-user preferences — post-hackathon.
- Beat-spec editing via natural language — PRD non-goal.

---

## 8. What success looks like

Before a beat ships: scout produces sources from ≥ 6 distinct
domains, spanning at least 3 of the 6 categories, with
`recipes_used` listing at least 3 different recipes. Editor
produces issues where ≥ 80% of items (at depth=standard) are
corroborated across ≥ 2 distinct-domain sources, with
`verification_notes` present on every deep item.

If those thresholds hold for 3 new beats across different topics
and languages, T1 + T3 ship. If not, iterate on the specific
recipe the agent is ignoring — likely the prompt ordering or
heuristic, not the recipe itself.
