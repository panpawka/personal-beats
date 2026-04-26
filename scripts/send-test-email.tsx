/**
 * Phase 9 test harness — render a fixture issue and send via Mailgun to the
 * user's inbox. Does NOT touch the DB; exercises render + Mailgun only.
 *
 * Uses Wasp's native `emailSender` (Mailgun provider). Dynamic-imports it
 * AFTER loadServerEnv so MAILGUN_* env vars are present at sender init.
 *
 * Run: `npx tsx --tsconfig scripts/tsconfig.json scripts/send-test-email.tsx [brief|standard|deep] [recipient]`
 *
 * Recipient defaults to the first entry in ADMIN_EMAILS.
 */
import * as React from "react";
import { render } from "@react-email/components";
import { loadServerEnv } from "./env-loader.js";
import { NewsletterEmail } from "../src/emails/NewsletterEmail.js";
import {
  fixtureSpec,
  fixtureBriefIssue,
  fixtureStandardIssue,
  fixtureDeepIssue,
} from "../src/emails/fixtures/common.js";
import type { EmailIssue } from "../src/emails/types.js";

loadServerEnv();

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} not set in .env.server`);
  return v;
}

const depth = (process.argv[2] ?? "standard") as "brief" | "standard" | "deep";
const recipientArg = process.argv[3];
const recipient =
  recipientArg ||
  (process.env.ADMIN_EMAILS ?? "").split(",")[0].trim();
if (!recipient) {
  throw new Error("recipient not given and ADMIN_EMAILS empty");
}

if (!["brief", "standard", "deep"].includes(depth)) {
  throw new Error(`depth must be brief|standard|deep, got ${depth}`);
}

const issue: EmailIssue =
  depth === "brief"
    ? fixtureBriefIssue
    : depth === "deep"
      ? fixtureDeepIssue
      : fixtureStandardIssue;

const WEB_BASE_URL = (process.env.WASP_WEB_CLIENT_URL ?? 'http://localhost:3000').replace(/\/$/, '');

req("MAILGUN_API_KEY");
req("MAILGUN_DOMAIN");

const element = React.createElement(NewsletterEmail, {
  spec: fixtureSpec(depth),
  issue,
  issueNumber: 1,
  unsubscribeUrl: `${WEB_BASE_URL}/beats/test?action=pause`,
  dashboardUrl: `${WEB_BASE_URL}/beats/test`,
});

const [html, text] = await Promise.all([
  render(element),
  render(element, { plainText: true }),
]);

console.log(
  `rendered ${depth}: html=${html.length}B text=${text.length}B; sending to ${recipient}`,
);

// Dynamic import so env vars are already loaded when the sender inits.
const { emailSender } = await import("wasp/server/email");

try {
  const info = await emailSender.send({
    to: recipient,
    subject: `[test-${depth}] ${issue.subject}`,
    html,
    text,
  });
  console.log(`sent — info=${JSON.stringify(info)}`);
} catch (err: unknown) {
  const e = err as { status?: number; details?: string; message?: string };
  console.error("Mailgun error:", e.status, e.message);
  if (e.details) console.error("details:", e.details);
  process.exit(1);
}
