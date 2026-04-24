import { Heading, Hr, Section, Text } from "@react-email/components";
import { NewsletterHeader } from "../components/NewsletterHeader";
import { NewsletterFooter } from "../components/NewsletterFooter";
import { Analysis } from "../components/Analysis";
import { ItemFooter } from "../components/ItemFooter";
import { SecondarySources, SourceLink } from "../components/SourceLink";
import type { EmailItem, LayoutProps } from "../types";

export function DeepLayout({ spec, issue, issueNumber, unsubscribeUrl, dashboardUrl }: LayoutProps) {
  return (
    <>
      <NewsletterHeader
        spec={spec}
        issueDate={issue.issue_date}
        issueNumber={issueNumber}
        subject={issue.subject}
        dek={issue.dek}
      />
      {issue.items.map((item, idx) => (
        <DeepItem key={item.fingerprint} item={item} index={idx + 1} />
      ))}
      <NewsletterFooter
        unsubscribeUrl={unsubscribeUrl}
        dashboardUrl={dashboardUrl}
        coverageNote={issue.coverage_note}
      />
    </>
  );
}

function DeepItem({ item, index }: { item: EmailItem; index: number }) {
  const paragraphs = splitParagraphs(item.summary);
  return (
    <Section className="mb-8">
      <Text className="m-0 text-xs uppercase tracking-wider text-gray-500">
        Story {index}
      </Text>
      <Heading as="h2" className="mt-1 mb-3 text-xl font-bold text-gray-900 leading-7">
        {item.headline}
      </Heading>
      {paragraphs.map((p, i) => (
        <Text key={i} className="m-0 mb-3 text-sm text-gray-800 leading-6">
          {p}
        </Text>
      ))}
      {item.why_it_matters ? (
        <Analysis label="Analysis">{item.why_it_matters}</Analysis>
      ) : null}
      <Section className="mt-4">
        <SourceLink url={item.primary_source_url} />
        <SecondarySources urls={item.secondary_source_urls ?? []} />
      </Section>
      <ItemFooter
        feedbackUpUrl={item.feedbackUpUrl}
        feedbackDownUrl={item.feedbackDownUrl}
      />
      <Hr className="border-gray-200 my-6" />
    </Section>
  );
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
