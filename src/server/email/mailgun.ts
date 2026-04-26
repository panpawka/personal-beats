/**
 * Phase 9 — Newsletter send via Wasp's native emailSender (Mailgun provider).
 *
 * sendNewsletter(issueId) is the one public entrypoint:
 *   - Loads Issue + items + beat + user (email)
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
import { prisma } from "wasp/server";
import { emailSender } from "wasp/server/email";
import { getEmail } from "wasp/auth";
import { NewsletterEmail } from "../../emails/NewsletterEmail.js";
import type { EmailIssue, EmailItem } from "../../emails/types.js";
import type { BeatSpec } from "../../shared/types.js";

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

function formatIssueDate(date: Date, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale || "en", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function toEmailIssue(issue: LoadedIssue, locale: string): EmailIssue {
  const items: EmailItem[] = issue.items.map((it) => ({
    headline: it.headline,
    summary: it.summary,
    why_it_matters: it.whyItMatters ?? undefined,
    primary_source_url: it.primarySourceUrl,
    secondary_source_urls: parseJsonArray(it.secondarySourceUrls),
    fingerprint: it.fingerprint,
    tags: parseJsonArray(it.tags),
  }));

  return {
    beat_slug: issue.beat.slug,
    issue_date: formatIssueDate(issue.issueDate, locale),
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
  const WEB_BASE_URL = process.env.WASP_WEB_CLIENT_URL ?? 'http://localhost:3000';

  const issue = await loadIssueForSend(issueId);
  const recipient = getEmail(issue.beat.user);
  if (!recipient) {
    throw new Error(`User ${issue.beat.userId} has no email identity`);
  }

  const spec = toBeatSpec(issue.beat);
  const priorCount = await countPriorIssues(issue.beatId, issue.publishedAt);
  const issueNumber = priorCount + 1;
  const emailIssue = toEmailIssue(issue, spec.output_language);

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
