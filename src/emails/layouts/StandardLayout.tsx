import { Section } from "@react-email/components";
import { NewsletterHeader } from "../components/NewsletterHeader";
import { NewsletterFooter } from "../components/NewsletterFooter";
import { StandardItem } from "../components/Item";
import type { LayoutProps } from "../types";

export function StandardLayout({ spec, issue, issueNumber, unsubscribeUrl, dashboardUrl }: LayoutProps) {
  return (
    <>
      <NewsletterHeader
        spec={spec}
        issueDate={issue.issue_date}
        issueNumber={issueNumber}
        subject={issue.subject}
        dek={issue.dek}
      />
      <Section>
        {issue.items.map((item, idx) => (
          <StandardItem key={item.fingerprint} item={item} index={idx + 1} />
        ))}
      </Section>
      <NewsletterFooter
        unsubscribeUrl={unsubscribeUrl}
        dashboardUrl={dashboardUrl}
        coverageNote={issue.coverage_note}
      />
    </>
  );
}
