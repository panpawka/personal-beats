import type { BeatSpec } from "../../shared/types";
import type { EmailIssue, EmailItem } from "../types";

export const fixtureSpec = (depth: "brief" | "standard" | "deep"): BeatSpec => ({
  beat_slug: "wroclaw-daily",
  title: "Wrocław Daily",
  topic: {
    primary: "Local news and civic updates for Wrocław",
    include: ["city council", "transport", "culture"],
    exclude: ["national politics", "sports scores"],
  },
  geography: {
    scope: "city",
    primary: "Wrocław, PL",
    radius_km: 20,
  },
  audience: "Wrocław resident who follows city affairs closely",
  cadence: {
    type: "time_based",
    cron: "0 7 * * 1-5",
    timezone: "Europe/Warsaw",
  },
  depth,
  output_language: "en",
  created_at: "2026-04-20T08:00:00Z",
  version: 1,
});

const item = (
  fp: string,
  headline: string,
  summary: string,
  extras: Partial<EmailItem> = {},
): EmailItem => ({
  headline,
  summary,
  primary_source_url: "https://www.wroclaw.pl/en/example-article",
  secondary_source_urls: [],
  fingerprint: fp,
  tags: ["kino", "animacja"],
  ...extras,
});

export const fixtureBriefIssue: EmailIssue = {
  beat_slug: "wroclaw-daily",
  issue_date: "2026-04-24",
  subject: "Four things from Wrocław today",
  dek: "Tram disruption, new park bid, library hours, theatre opening",
  coverage_note: "Thin council coverage today — next issue should rebound.",
  items: [
    item(
      "fp-b1",
      "Tram line 17 partially suspended through Friday",
      "MPK diverts around Dworcowa bridge works; replacement bus 717 runs every 8 min.",
    ),
    item(
      "fp-b2",
      "Council opens bids for Park Południowy refresh",
      "Tenders close 12 May; scope includes playgrounds, lighting, and a dog run.",
    ),
    item(
      "fp-b3",
      "Main library extends weekend hours through June",
      "Rynek branch now open Saturdays until 20:00; Sunday hours unchanged.",
    ),
    item(
      "fp-b4",
      "Teatr Polski premieres ‘Wesele’ revival Friday",
      "Directed by Maja Kleczewska; tickets from 45 zł, run through 17 May.",
    ),
  ],
};

export const fixtureStandardIssue: EmailIssue = {
  beat_slug: "wroclaw-daily",
  issue_date: "2026-04-24",
  subject: "Wrocław council greenlights Oława bridge retrofit",
  dek: "Plus: MPK strike averted, new Odra cycleway segment opens Saturday.",
  coverage_note: "Healthy source coverage today (12 verified).",
  items: [
    item(
      "fp-s1",
      "Council approves 84 M zł Oława bridge retrofit",
      "A 13-2 vote greenlights structural rework of the Most Oławski, with work beginning in June and expected to last 18 months. Opponents cited cost overruns on the 2024 Most Grunwaldzki project.",
      {
        why_it_matters:
          "The Most Oławski carries 40k vehicles/day — closures will reroute traffic through Grabiszyn and likely push tram 31 onto a shuttle pattern.",
        primary_source_url: "https://www.wroclaw.pl/en/city-council-bridges",
        secondary_source_urls: ["https://tuwroclaw.com/wiadomosci/most-olawski-remont"],
      },
    ),
    item(
      "fp-s2",
      "MPK and Solidarność reach pay deal, Thursday strike called off",
      "A 9.1% base raise plus a 2,400 zł one-time bonus resolves the dispute announced last week. Service returns to normal schedule Thursday morning.",
      {
        why_it_matters:
          "Avoids the first MPK strike since 2019 and removes a headline risk for the mayor ahead of May budget talks.",
        primary_source_url: "https://www.mpk.wroc.pl/news/strike-resolved",
      },
    ),
    item(
      "fp-s3",
      "Odra cycleway: Swojczyce segment opens Saturday",
      "The 2.3 km extension links Swojczyce to Biskupin via a separated two-way path, closing the last gap between Zalew Bartoszowicki and Wyspa Słodowa.",
      {
        primary_source_url: "https://www.wroclaw.pl/en/cycling-odra-swojczyce",
        secondary_source_urls: ["https://wroclaw.wyborcza.pl/cycleway-odra"],
      },
    ),
    item(
      "fp-s4",
      "Pawilon Czterech Kopuł reopens after HVAC overhaul",
      "Closed since February, the museum restarts with the long-delayed Tadeusz Kantor retrospective on 3 May.",
      {
        primary_source_url: "https://pawilonczterechkopul.pl/news/reopen-may",
      },
    ),
    item(
      "fp-s5",
      "Wrocław airport adds Lisbon route from July",
      "TAP Portugal schedules four weekly flights starting 7 July; LOT declined to match the route.",
      {
        why_it_matters:
          "First direct Iberia link since 2020; tourism board projects ~18k incoming seats through September.",
        primary_source_url: "https://airport.wroclaw.pl/news/tap-lisbon",
      },
    ),
  ],
};

export const fixtureDeepIssue: EmailIssue = {
  beat_slug: "wroclaw-daily",
  issue_date: "2026-04-24",
  subject: "How Wrocław’s water utility quietly rebuilt the Psie Pole main",
  dek: "A three-year, 220 M zł retrofit finished on time — and almost nobody noticed.",
  coverage_note: "Healthy coverage; two independent audits referenced.",
  items: [
    item(
      "fp-d1",
      "MPWiK closes the Psie Pole water-main project two weeks ahead of schedule",
      `The Municipal Water and Sewerage Company (MPWiK) announced on Wednesday that the final joint on the 14-kilometre Psie Pole redundancy main has been welded and pressure-tested, ending a three-year retrofit that replaced the 1970s-era primary feed serving roughly 90,000 residents in Wrocław’s northeast.

Project director Anna Sobczak said the utility absorbed a 6% cost increase on steel piping by reusing excavation contractors across overlapping segments rather than rebidding each phase — a decision she credited to lessons from the Most Grunwaldzki overruns.

The new main operates in parallel with the original, allowing the older line to be taken down for maintenance without service interruption. Independent audits by Arcadis and Sweco confirmed burst resilience at 1.6 MPa, 30% above the municipal minimum.`,
      {
        why_it_matters:
          "Psie Pole, Swojczyce, and parts of Biskupin now have the same two-main redundancy that central Wrocław has had since 2008. It is also a rare case of a large municipal capital project finishing at or under budget — useful leverage for MPWiK in the 2027 tariff negotiation.",
        primary_source_url: "https://mpwik.wroc.pl/news/psie-pole-main-complete",
        secondary_source_urls: [
          "https://www.wroclaw.pl/en/water-infrastructure-update",
          "https://tuwroclaw.com/inwestycje/mpwik-psie-pole",
        ],
      },
    ),
    item(
      "fp-d2",
      "Culture budget debate: opera wins, fringe loses",
      `The revised 2026 culture allocation, signed Tuesday, raises the Wrocław Opera grant by 12% to 47 M zł while cutting the open-call fringe fund from 3.2 M zł to 2.1 M zł.

Culture committee chair Piotr Szymański framed the shift as a response to the opera’s record 92% house fill and three Grammy-adjacent recording nominations in the past eighteen months. Fringe venues disagreed sharply: a joint letter signed by Studio BWA, Agora, and Cafe Rozrusznik argues the cut will force at least two programmed series to close by autumn.

The council compromise keeps the residency programme at Pawilon Czterech Kopuł funded separately, partially buffering visual-arts organisations from the fringe cuts.`,
      {
        why_it_matters:
          "Sets the tone for the May long-range budget, where the libraries and the Centrum Historii Zajezdnia will argue the same ‘prestige vs. access’ frame. Expect the same coalition that passed the opera raise to be lobbied hard.",
        primary_source_url: "https://www.wroclaw.pl/en/culture-budget-2026",
        secondary_source_urls: ["https://wroclaw.wyborcza.pl/culture-budget-response"],
      },
    ),
    item(
      "fp-d3",
      "Heat utility Fortum warns of 9% winter tariff rise",
      `Fortum, which operates Wrocław’s district heating network, filed a draft tariff with URE last Friday seeking a 9% rise for the 2026–27 heating season. The company attributes 6 points of the increase to continued coal-to-gas conversion at the Czechnica plant, and 3 points to wholesale gas pricing.

City Hall has not yet said whether it will formally object; URE has 90 days to rule. Previous filings in 2022 and 2024 were approved at 80–95% of the requested level.`,
      {
        why_it_matters:
          "A 9% rise would push the average central-Wrocław flat’s winter heating bill up roughly 40 zł/month. Politically, it lands during the same window as the waste-fee review — two compounding bill increases for the same households.",
        primary_source_url: "https://fortum.pl/news/wroclaw-tariff-filing",
      },
    ),
    item(
      "fp-d4",
      "Startup note: Vecto raises 12 M€ Series B, stays headquartered in Wrocław",
      `Electric-bus logistics startup Vecto closed a 12 M€ Series B led by Speedinvest with participation from bValue and Polish state fund PFR Ventures. CEO Magda Krawczyk confirmed the company will keep its HQ and 60-person engineering team in Wrocław rather than relocating to Berlin, citing “no compelling reason to move away from the talent we already have.”

Vecto’s platform schedules charging for municipal bus fleets across 14 cities, including MPK Wrocław’s pilot on two electric lines.`,
      {
        primary_source_url: "https://vecto.io/blog/series-b",
        secondary_source_urls: [
          "https://mamstartup.pl/vecto-series-b",
          "https://www.euronews.com/next/vecto-funding",
        ],
      },
    ),
  ],
};
