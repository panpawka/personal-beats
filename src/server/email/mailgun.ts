/**
 * Phase 9 — Newsletter send via Wasp's native emailSender (Mailgun provider).
 *
 * sendNewsletter(issueId) is the one public entrypoint:
 *   - Loads Issue + items + beat + user (email)
 *   - Mints one JWT per IssueItem (claims: itemId, userId). Direction (up/down)
 *     rides in the URL as ?v=up|down. Direction is not signed — threat model
 *     is a personal newsletter; only the recipient has incentive to click.
 *   - Reconstructs a minimal BeatSpec from the Beat row (email components
 *     only touch spec.title, depth, output_language).
 *   - Renders HTML + plain-text via react-email's async render().
 *   - Persists htmlBody/plainBody on the Issue BEFORE the send attempt, so
 *     the dashboard can show exactly what was queued even if the send fails.
 *   - Dispatches via `emailSender.send`; provider + creds come from main.wasp
 *     `emailSender: { provider: Mailgun, ... }` and MAILGUN_* env vars.
 *   - Flips emailStatus to SENT or FAILED.
 *
 * Phase 11's pg-boss generateIssueJob is the expected caller.
 */
import * as React from "react";
import { render } from "@react-email/components";
import jwt from "jsonwebtoken";
import { prisma } from "wasp/server";
import { emailSender } from "wasp/server/email";
import { getEmail } from "wasp/auth";
import { NewsletterEmail } from "../../emails/NewsletterEmail.js";
import type { EmailIssue, EmailItem } from "../../emails/types.js";
import type { BeatSpec } from "../../shared/types.js";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} not set`);
  return v;
}

const FEEDBACK_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30d

export type FeedbackTokenClaims = {
  itemId: string;
  userId: string;
  iat: number;
  exp: number;
};

function signFeedbackToken(itemId: string, userId: string): string {
  return jwt.sign(
    { itemId, userId },
    env("JWT_SECRET"),
    { expiresIn: FEEDBACK_TOKEN_TTL_SECONDS },
  );
}

function feedbackUrl(serverBaseUrl: string, token: string, direction: "up" | "down"): string {
  // Feedback is a server-side `api feedbackMagicLink` route (Phase 10) at
  // /feedback/:token — must target WASP_SERVER_URL, not the client URL.
  return `${serverBaseUrl.replace(/\/$/, "")}/feedback/${token}?v=${direction}`;
}

function parseJsonArray(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

type LoadedIssue = Awaited<ReturnType<typeof loadIssueForSend>>;

async function loadIssueForSend(issueId: string) {
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    include: {
      items: { orderBy: { orderIndex: "asc" } },
      beat: {
        include: {
          user: { include: { auth: { include: { identities: true } } } },
        },
      },
    },
  });
  if (!issue) throw new Error(`Issue ${issueId} not found`);
  return issue;
}

function toBeatSpec(beat: LoadedIssue["beat"]): BeatSpec {
  // Minimal reconstruction — email components only read title, depth,
  // output_language. Full spec lives in the memory store; we don't fetch it
  // to avoid a network round-trip on every send.
  return {
    beat_slug: beat.slug,
    title: beat.title,
    topic: { primary: "", include: [], exclude: [] },
    geography: { scope: "city", primary: null, radius_km: null },
    audience: "",
    cadence: {
      type: beat.cadenceType === "ON_DEMAND" ? "on_demand" : "time_based",
      cron: beat.cronExpression,
      timezone: beat.timezone,
    },
    depth: beat.depth.toLowerCase() as BeatSpec["depth"],
    output_language: beat.outputLanguage,
    created_at: beat.createdAt.toISOString(),
    version: 1,
  };
}

function toEmailIssue(
  issue: LoadedIssue,
  tokensByItemId: Map<string, string>,
  serverBaseUrl: string,
): EmailIssue {
  const items: EmailItem[] = issue.items.map((it) => {
    const token = tokensByItemId.get(it.id)!;
    return {
      headline: it.headline,
      summary: it.summary,
      why_it_matters: it.whyItMatters ?? undefined,
      primary_source_url: it.primarySourceUrl,
      secondary_source_urls: parseJsonArray(it.secondarySourceUrls),
      fingerprint: it.fingerprint,
      tags: parseJsonArray(it.tags),
      feedbackUpUrl: feedbackUrl(serverBaseUrl, token, "up"),
      feedbackDownUrl: feedbackUrl(serverBaseUrl, token, "down"),
    };
  });

  return {
    beat_slug: issue.beat.slug,
    issue_date: issue.issueDate.toISOString().slice(0, 10),
    subject: issue.subject,
    dek: issue.dek,
    coverage_note: issue.coverageNote ?? undefined,
    items,
  };
}

async function countPriorIssues(beatId: string, before: Date): Promise<number> {
  return prisma.issue.count({
    where: { beatId, publishedAt: { lt: before } },
  });
}

export type SendResult =
  | { status: "SENT"; issueId: string }
  | { status: "FAILED"; issueId: string; error: string };

/**
 * Render + dispatch the newsletter for an Issue. Idempotent-ish: if called
 * twice, both sends go out — callers should gate on `emailStatus === "PENDING"`.
 * For the Phase 11 cron job we'll wrap this in a claim-then-send transaction.
 */
export async function sendNewsletter(issueId: string): Promise<SendResult> {
  const WEB_BASE_URL = env("WASP_WEB_CLIENT_URL");
  const SERVER_BASE_URL = env("WASP_SERVER_URL");
  env("JWT_SECRET"); // asserted early; signFeedbackToken re-reads

  const issue = await loadIssueForSend(issueId);
  const recipient = getEmail(issue.beat.user);
  if (!recipient) {
    throw new Error(`User ${issue.beat.userId} has no email identity`);
  }

  // Mint and persist one token per item. If an item already has a token
  // (e.g. retry after a failed send), reuse it.
  const tokensByItemId = new Map<string, string>();
  for (const item of issue.items) {
    let token = item.feedbackToken;
    if (!token) {
      token = signFeedbackToken(item.id, issue.beat.userId);
      await prisma.issueItem.update({
        where: { id: item.id },
        data: { feedbackToken: token },
      });
    }
    tokensByItemId.set(item.id, token);
  }

  const spec = toBeatSpec(issue.beat);
  const priorCount = await countPriorIssues(issue.beatId, issue.publishedAt);
  const issueNumber = priorCount + 1;
  const emailIssue = toEmailIssue(issue, tokensByItemId, SERVER_BASE_URL);

  const dashboardUrl = `${WEB_BASE_URL.replace(/\/$/, "")}/beats/${issue.beatId}`;
  const unsubscribeUrl = `${WEB_BASE_URL.replace(/\/$/, "")}/beats/${issue.beatId}?action=pause`;

  const element = React.createElement(NewsletterEmail, {
    spec,
    issue: emailIssue,
    issueNumber,
    unsubscribeUrl,
    dashboardUrl,
  });

  const [htmlBody, plainBody] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);

  // Persist rendered bodies BEFORE attempting send, so the dashboard always
  // reflects what was queued even if Mailgun rejects.
  await prisma.issue.update({
    where: { id: issueId },
    data: { htmlBody, plainBody, emailStatus: "PENDING" },
  });

  try {
    await emailSender.send({
      to: recipient,
      subject: issue.subject,
      html: htmlBody,
      text: plainBody,
    });
    await prisma.issue.update({
      where: { id: issueId },
      data: { emailStatus: "SENT", emailSentAt: new Date() },
    });
    return { status: "SENT", issueId };
  } catch (err) {
    const error = String(err).slice(0, 500);
    await prisma.issue.update({
      where: { id: issueId },
      data: { emailStatus: "FAILED" },
    });
    return { status: "FAILED", issueId, error };
  }
}
