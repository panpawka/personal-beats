/**
 * Phase 10 — Feedback magic-link endpoint.
 *
 * GET /feedback/:token?v=up|down
 *
 * Auth comes from the signed JWT in the path (claims: itemId, userId, exp).
 * The direction (up/down) is in the query string and intentionally NOT signed
 * — threat model is a personal newsletter where only the recipient has any
 * incentive to click. Worst case: someone guesses a URL and flips one item's
 * feedback. The action is reversible from the dashboard.
 *
 * On any failure (bad token, expired, mismatched user, missing item) we
 * redirect to the dashboard with a toast-able query param rather than
 * returning JSON — these are clicks from email, the user is in a browser.
 */
import jwt from "jsonwebtoken";
import type { FeedbackMagicLink } from "wasp/server/api";
import { prisma } from "wasp/server";
import type { FeedbackTokenClaims } from "./email/mailgun.js";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} not set`);
  return v;
}

function dashboardRedirect(status: string, extra?: Record<string, string>): string {
  const base = env("WASP_WEB_CLIENT_URL").replace(/\/$/, "");
  const params = new URLSearchParams({ feedback: status, ...(extra ?? {}) });
  return `${base}/dashboard?${params.toString()}`;
}

export const feedbackMagicLink: FeedbackMagicLink = async (req, res) => {
  const { token } = req.params as { token: string };
  const direction = String((req.query as { v?: string }).v ?? "").toLowerCase();

  if (direction !== "up" && direction !== "down") {
    res.redirect(302, dashboardRedirect("invalid"));
    return;
  }

  let claims: FeedbackTokenClaims;
  try {
    const decoded = jwt.verify(token, env("JWT_SECRET"));
    if (
      typeof decoded !== "object" ||
      decoded === null ||
      typeof (decoded as { itemId?: unknown }).itemId !== "string" ||
      typeof (decoded as { userId?: unknown }).userId !== "string"
    ) {
      throw new Error("malformed claims");
    }
    claims = decoded as FeedbackTokenClaims;
  } catch (err) {
    const status = (err as Error).name === "TokenExpiredError" ? "expired" : "invalid";
    res.redirect(302, dashboardRedirect(status));
    return;
  }

  const item = await prisma.issueItem.findUnique({
    where: { id: claims.itemId },
    include: { issue: { include: { beat: true } } },
  });
  if (!item || item.issue.beat.userId !== claims.userId) {
    res.redirect(302, dashboardRedirect("invalid"));
    return;
  }

  const feedback = direction === "up" ? "POSITIVE" : "NEGATIVE";
  await prisma.issueItem.update({
    where: { id: item.id },
    data: { feedback, feedbackAt: new Date() },
  });

  res.redirect(
    302,
    dashboardRedirect("recorded", { v: direction, beatId: item.issue.beatId }),
  );
};
