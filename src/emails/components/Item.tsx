import { Heading, Section, Text } from "@react-email/components";
import { SecondarySources, SourceLink } from "./SourceLink";
import { ItemFooter } from "./ItemFooter";
import type { EmailItem } from "../types";

interface StandardItemProps {
  item: EmailItem;
  index: number;
}

export function StandardItem({ item, index }: StandardItemProps) {
  return (
    <Section className="mb-6 pb-5 border-b border-solid border-gray-100">
      <Heading as="h2" className="m-0 mb-2 text-lg font-semibold text-gray-900">
        {index}. {item.headline}
      </Heading>
      <Text className="m-0 mb-3 text-sm text-gray-800 leading-6">{item.summary}</Text>
      {item.why_it_matters ? (
        <Section className="bg-amber-50 border-l-4 border-solid border-amber-400 pl-3 py-2 mb-3">
          <Text className="m-0 text-xs uppercase tracking-wider text-amber-700 font-semibold">
            Why it matters
          </Text>
          <Text className="m-0 text-sm text-gray-800">{item.why_it_matters}</Text>
        </Section>
      ) : null}
      <SourceLink url={item.primary_source_url} />
      <SecondarySources urls={item.secondary_source_urls ?? []} />
      <ItemFooter
        feedbackUpUrl={item.feedbackUpUrl}
        feedbackDownUrl={item.feedbackDownUrl}
      />
    </Section>
  );
}

export function BriefItem({ item, index }: StandardItemProps) {
  return (
    <Section className="mb-3">
      <Text className="m-0 text-sm text-gray-900">
        <span className="font-semibold">
          {index}. {item.headline}
        </span>
        {" — "}
        <span className="text-gray-700">{item.summary}</span>{" "}
        <SourceLink url={item.primary_source_url} variant="inline" />
      </Text>
    </Section>
  );
}
