import type { BeatSpec, PublishIssueInput, PublishIssueItem } from "../shared/types";

export type EmailItem = PublishIssueItem;

export type EmailIssue = Omit<PublishIssueInput, "items"> & {
  items: EmailItem[];
};

export interface NewsletterEmailProps {
  spec: BeatSpec;
  issue: EmailIssue;
  issueNumber: number;
  unsubscribeUrl: string;
  dashboardUrl: string;
}

export interface LayoutProps extends NewsletterEmailProps {}
