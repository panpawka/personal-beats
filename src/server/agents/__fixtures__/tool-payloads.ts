// Valid and invalid sample payloads for each custom tool. Used by
// scripts/test-schemas.ts to exercise Zod validation.

export const needsClarificationValid = {
  questions: [
    "What age range should this beat cover? (0-5, 6-12, or teens?)",
    "Who is the primary reader — parents or educators?",
  ],
  reasoning: "Age range shifts the beat massively.",
};

export const needsClarificationInvalid = {
  // too many questions
  questions: ["q1", "q2", "q3"],
  reasoning: "",
};

export const finalizeBeatSpecValid = {
  beat_slug: "wroclaw-daily",
  summary: "Daily Polish-language digest for Wrocław residents.",
  defaults_applied: ["depth=standard", "cadence=0 7 * * *"],
};

export const finalizeBeatSpecInvalid = {
  // missing defaults_applied
  beat_slug: "wroclaw-daily",
  summary: "...",
};

export const scoutCompleteValid = {
  beat_slug: "wroclaw-daily",
  source_count: 17,
  distinct_domains: 12,
  categories_covered: ["press", "official", "community", "aggregator"] as const,
  recipes_used: ["google_news_rss", "rss_autodiscovery", "reddit_json"],
  coverage_assessment: "healthy" as const,
  notes: "17 verified sources across press, official, community categories.",
};

export const scoutCompleteInvalid = {
  beat_slug: "wroclaw-daily",
  source_count: -1, // negative
  coverage_assessment: "excellent", // not in enum
  notes: "",
};

export const publishIssueValid = {
  beat_slug: "wroclaw-daily",
  issue_date: "2026-04-24",
  subject: "Wrocław Daily — 24 kwietnia",
  dek: "Rada miejska, MPK, Śląsk Wrocław.",
  items: [
    {
      headline: "Rada miejska głosuje nad nową linią tramwajową",
      summary: "Komisja zatwierdziła projekt linii...",
      why_it_matters: "Skróci dojazd do Psiego Pola o 12 min.",
      primary_source_url: "https://wroclaw.pl/rada-miejska-nowa-linia",
      secondary_source_urls: ["https://gazetawroclawska.pl/2026/04/24/tramwaj"],
      fingerprint: "rada-tramwaj-2026-04-24",
      tags: ["transport", "rada-miejska"],
    },
  ],
  coverage_note: "Normal news day.",
};

export const publishIssueInvalid = {
  // bad date format + dek too long
  beat_slug: "wroclaw-daily",
  issue_date: "24/04/2026",
  subject: "x",
  dek: "a".repeat(200),
  items: [],
};
