/**
 * Minimal Zod validation tests for the four custom-tool payload schemas.
 * Runs without touching the API or DB. Exits non-zero on any failure.
 *
 * Run: `npx tsx scripts/test-schemas.ts`
 */
import {
  FinalizeBeatSpecSchema,
  NeedsClarificationSchema,
  PublishIssueSchema,
  ScoutCompleteSchema,
} from "../src/shared/types.js";
import {
  finalizeBeatSpecInvalid,
  finalizeBeatSpecValid,
  needsClarificationInvalid,
  needsClarificationValid,
  publishIssueInvalid,
  publishIssueValid,
  scoutCompleteInvalid,
  scoutCompleteSparse,
  scoutCompleteValid,
} from "../src/server/agents/__fixtures__/tool-payloads.js";

type Case = {
  name: string;
  parse: (x: unknown) => { success: boolean };
  input: unknown;
  expect: "pass" | "fail";
};

const cases: Case[] = [
  {
    name: "needs_clarification valid",
    parse: (x) => NeedsClarificationSchema.safeParse(x),
    input: needsClarificationValid,
    expect: "pass",
  },
  {
    name: "needs_clarification invalid (3 questions)",
    parse: (x) => NeedsClarificationSchema.safeParse(x),
    input: needsClarificationInvalid,
    expect: "fail",
  },
  {
    name: "finalize_beat_spec valid",
    parse: (x) => FinalizeBeatSpecSchema.safeParse(x),
    input: finalizeBeatSpecValid,
    expect: "pass",
  },
  {
    name: "finalize_beat_spec invalid (missing defaults_applied)",
    parse: (x) => FinalizeBeatSpecSchema.safeParse(x),
    input: finalizeBeatSpecInvalid,
    expect: "fail",
  },
  {
    name: "scout_complete valid",
    parse: (x) => ScoutCompleteSchema.safeParse(x),
    input: scoutCompleteValid,
    expect: "pass",
  },
  {
    name: "scout_complete sparse (Zod accepts; drive.ts override enforces)",
    parse: (x) => ScoutCompleteSchema.safeParse(x),
    input: scoutCompleteSparse,
    expect: "pass",
  },
  {
    name: "scout_complete invalid (negative count, bad enum)",
    parse: (x) => ScoutCompleteSchema.safeParse(x),
    input: scoutCompleteInvalid,
    expect: "fail",
  },
  {
    name: "publish_issue valid",
    parse: (x) => PublishIssueSchema.safeParse(x),
    input: publishIssueValid,
    expect: "pass",
  },
  {
    name: "publish_issue invalid (bad date, dek too long)",
    parse: (x) => PublishIssueSchema.safeParse(x),
    input: publishIssueInvalid,
    expect: "fail",
  },
];

let failed = 0;
for (const c of cases) {
  const { success } = c.parse(c.input);
  const ok = (c.expect === "pass") === success;
  console.log(
    `${ok ? "OK  " : "FAIL"}  ${c.name}  (got ${success ? "pass" : "fail"}, expected ${c.expect})`,
  );
  if (!ok) failed++;
}

if (failed > 0) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log(`\n${cases.length}/${cases.length} cases passed`);
