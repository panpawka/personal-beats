# Findings: Claude Managed Agents + smarter sourcing for newsletter app

## Current situation
- The app idea is a personalized newsletter agent where users define topics such as:
  - `aktywnosci we wroclawiu`
  - `sytuacja wojny w Iranie`
  - `wiadomosci ze swiata IT`
- Current sourcing relies mostly on Claude Managed Agents built-in `web_search`
- Problem: `web_search` is useful, but too generic for high-quality newsletter sourcing
- Main bottleneck is **source scouting**, not just summarization

## Key conclusion
Do **not** redesign everything from scratch.

Instead:
- keep Claude Managed Agents as the orchestrator
- keep built-in `web_search` enabled
- add a thin custom research/sourcing layer on top

This matches Anthropic’s model:
- Managed Agents supports custom tools
- the model does not execute tools itself
- it emits structured tool calls
- the app/backend executes them and returns results

## Why built-in web_search is not enough
`web_search` is good for:
- broad discovery
- current web lookups
- fallback retrieval

But it is weak for:
- source quality control
- topic-specific source selection
- local relevance
- deduplication
- clustering repeated stories
- ranking results for newsletter usefulness
- learning which sources are actually good over time

## Recommended architecture
Use a hybrid approach:

1. Claude Managed Agents orchestrates the task
2. built-in `web_search` remains available
3. custom tools handle:
   - source discovery
   - result normalization
   - clustering and ranking
   - newsletter-oriented preparation

## Recommended custom tool set
Start small with 4 tools:

### 1. `news_search_curated`
Purpose:
- retrieve candidate sources for a topic using smarter logic than generic search

What it should do:
- accept topic, language, region, freshness window, topic type
- route search differently for:
  - `local_events`
  - `geopolitics`
  - `tech_news`
  - `general_news`
- internally query one or more providers
- normalize results into one schema
- apply light filtering
- return compact candidate records

Important:
- this is **not** a final summarizer
- this is a smart retrieval layer

### 2. `news_extract_url`
Purpose:
- fetch and normalize a specific URL into structured content

Should return fields like:
- title
- source_name
- published_at
- body_text or summary
- location / event_date / price when relevant

### 3. `news_cluster_rank`
Purpose:
- deduplicate and cluster overlapping results
- score them for usefulness

Should score by things like:
- freshness
- relevance
- source quality
- locality
- originality
- diversity of coverage

### 4. `newsletter_compose_context`
Purpose:
- transform ranked clusters into newsletter-ready structured sections
- not necessarily final prose, but clean context for drafting

## Most important idea: don’t expose many raw tools
Do **not** expose lots of separate overlapping search APIs directly to Claude.

Bad:
- `exa_search`
- `tavily_search`
- `brave_search`
- `rss_search`
- `events_api_search`
- etc.

Better:
- one stable tool like `news_search_curated`
- your backend decides which providers to call internally

Reason:
- fewer tools are easier for the model to use well
- this aligns with Anthropic guidance on tool design:
  - clear names
  - clear boundaries
  - token-efficient outputs
  - meaningful structured results

## How `news_search_curated` should work
It is a **smart retrieval orchestrator**, not a source itself.

Pipeline:
1. receive a scoped query
2. determine topic type / region / language / freshness
3. select a source strategy
4. query underlying providers
5. normalize all results
6. lightly filter junk / duplicates / wrong-language / stale items
7. return compact candidates

Example input:
```json
{
  "query": "aktywnosci we Wroclawiu na weekend",
  "topic_type": "local_events",
  "region": "Wroclaw, PL",
  "language": "pl",
  "time_range": "7d",
  "max_results": 20
}
```

Example output shape:
```json
{
  "item_id": "src_0192",
  "title": "Weekend events in Wroclaw",
  "url": "https://example.com/post",
  "source_name": "Example Source",
  "source_group": "events",
  "published_at": "2026-04-24T18:00:00Z",
  "language": "pl",
  "region": "Wroclaw, PL",
  "snippet": "A round-up of concerts, exhibitions, and family events.",
  "confidence": 0.82
}
```

## Where sources come from
`news_search_curated` does not create sources itself.
It gets them from whatever backends are wired into it.

Possible source channels:
- generic/semantic web search providers
- RSS/Atom feeds
- structured APIs
- event platforms
- official websites
- discovered domains

The important design point:
- Claude should not know or care which provider actually supplied the result
- the backend should hide provider-specific complexity

## Main product problem discovered
The real issue is **source scouting**.

You do **not** want to manually maintain big curated source lists.

So the better solution is:
- dynamic source discovery
- domain-level scoring
- gradual source memory

## Smart source scouting approach
Instead of hand-curating sources, implement a **source scouting pipeline**.

### Discovery loop
1. run broad search for the topic
2. collect URLs and domains
3. score domains, not just pages
4. identify promising domains
5. expand from those domains
6. save useful domains for future runs

### Domain-level signals
A domain/source can be scored by:
- topical relevance
- freshness
- language fit
- regional fit
- specificity / niche relevance
- originality
- historical yield (how often it returns useful results)

### Result
The system becomes self-improving:
- first runs are exploratory
- later runs reuse the domains that proved useful

This is **not** manual curation.
It is machine-assisted source memory.

## Discovery vs monitoring modes
A good implementation of `news_search_curated` can internally support:

### `discovery`
Use when:
- topic is new
- there is no known source set yet
- coverage is weak

Behavior:
- broad search
- domain extraction
- source scoring
- source expansion

### `monitoring`
Use when:
- some good domains have already been learned

Behavior:
- query remembered high-performing sources first
- fall back to broad discovery only when needed

## Do we need Tavily and Exa?
No — not from day one.

### MVP options
#### Option A: cheapest MVP
- Claude Managed Agents
- built-in `web_search`
- your own ranking / extraction logic later

#### Option B: good next step
- built-in `web_search`
- plus **one** external provider

#### Option C: more advanced
- built-in `web_search`
- Tavily
- Exa

## Which external provider to add first
### Tavily first if:
- you want cleaner search workflows
- easier filtering / scoring
- a practical AI-search style retrieval backend

### Exa first if:
- you care more about source scouting
- semantic search is important
- similar-site discovery / source expansion matters

### Important conclusion
You do **not** need both Tavily and Exa immediately.
Start with:
- built-in `web_search`
- then add **one** provider based on the bottleneck

## Best implementation strategy
Recommended phases:

### Phase 1
Keep current architecture mostly intact:
- Claude Managed Agents
- built-in `web_search`
- add custom tool interface definitions

### Phase 2
Implement:
- `news_search_curated`
- `news_extract_url`
- `news_cluster_rank`

### Phase 3
Add dynamic source memory:
- remember high-performing domains per topic class
- use remembered domains first
- fall back to discovery when needed

### Phase 4
Only if needed, add a second external search provider

## Tool design principles to follow
From Anthropic guidance:
- use fewer, broader tools instead of many tiny overlapping ones
- namespace tools clearly
- make descriptions explicit
- provide input examples
- return structured, high-signal, token-efficient outputs
- optimize tools through evaluation with real tasks
- use Claude Code / agents to improve tool descriptions and tool behavior iteratively

## Final recommended direction for current repo
Keep the current repository’s Managed Agents setup, but review it for these upgrades:

1. keep built-in `web_search`
2. add `news_search_curated` as the main research entry point
3. make `news_search_curated` internally support:
   - `discovery`
   - `monitoring`
4. avoid manual source curation
5. add domain/source memory based on observed good results
6. normalize all search outputs into one schema
7. add clustering and ranking before final newsletter generation

## High-level product thesis
The product moat is **not** “Claude can search the web.”

The moat is:
- better source scouting
- better source selection
- better deduplication
- better ranking
- better newsletter-oriented structuring

That should live in your custom tools and backend logic, while Claude Managed Agents remains the reasoning/orchestration layer.