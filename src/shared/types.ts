import { z } from "zod";

// -------- String-union enums (SQLite can't store Prisma enums) --------

export const BeatStatusValues = [
  "DRAFT",
  "DESIGNING",
  "AWAITING_CLARIFICATION",
  "SCOUTING",
  "ACTIVE",
  "PAUSED",
  "FAILED",
] as const;
export type BeatStatus = (typeof BeatStatusValues)[number];

export const CadenceTypeValues = ["TIME_BASED", "ON_DEMAND"] as const;
export type CadenceType = (typeof CadenceTypeValues)[number];

export const DepthValues = ["BRIEF", "STANDARD", "DEEP"] as const;
export type Depth = (typeof DepthValues)[number];

export const EmailStatusValues = ["PENDING", "SENT", "FAILED"] as const;
export type EmailStatus = (typeof EmailStatusValues)[number];

export const FeedbackValues = ["POSITIVE", "NEGATIVE"] as const;
export type Feedback = (typeof FeedbackValues)[number];

// -------- Beat spec (mirrors /spec.yaml structure) --------

export const BeatSpecSchema = z.object({
  beat_slug: z.string(),
  title: z.string(),
  topic: z.object({
    primary: z.string(),
    include: z.array(z.string()).default([]),
    exclude: z.array(z.string()).default([]),
  }),
  geography: z.object({
    scope: z.enum(["city", "region", "country", "global"]),
    primary: z.string().nullable(),
    radius_km: z.number().int().nullable(),
  }),
  audience: z.string(),
  cadence: z.object({
    type: z.enum(["time_based", "on_demand"]),
    cron: z.string().nullable(),
    timezone: z.string().nullable(),
  }),
  depth: z.enum(["brief", "standard", "deep"]),
  output_language: z.string(),
  created_at: z.string(),
  version: z.number().int().default(1),
});
export type BeatSpec = z.infer<typeof BeatSpecSchema>;

// -------- Custom tool input schemas (validated on every tool_use event) --------

export const NeedsClarificationSchema = z.object({
  questions: z.array(z.string()).min(1).max(2),
  reasoning: z.string(),
});
export type NeedsClarificationInput = z.infer<typeof NeedsClarificationSchema>;

export const FinalizeBeatSpecSchema = z.object({
  beat_slug: z.string(),
  summary: z.string(),
  defaults_applied: z.array(z.string()),
});
export type FinalizeBeatSpecInput = z.infer<typeof FinalizeBeatSpecSchema>;

export const ScoutCompleteSchema = z.object({
  beat_slug: z.string(),
  source_count: z.number().int().nonnegative(),
  coverage_assessment: z.enum(["healthy", "thin", "sparse"]),
  notes: z.string(),
});
export type ScoutCompleteInput = z.infer<typeof ScoutCompleteSchema>;

export const PublishIssueItemSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  why_it_matters: z.string().optional(),
  primary_source_url: z.string().url(),
  secondary_source_urls: z.array(z.string().url()).default([]),
  fingerprint: z.string(),
  tags: z.array(z.string()).default([]),
});
export type PublishIssueItem = z.infer<typeof PublishIssueItemSchema>;

export const PublishIssueSchema = z.object({
  beat_slug: z.string(),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  subject: z.string(),
  dek: z.string().max(140),
  items: z.array(PublishIssueItemSchema),
  coverage_note: z.string().optional(),
});
export type PublishIssueInput = z.infer<typeof PublishIssueSchema>;
