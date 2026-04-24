import { Heading, Section, Text } from "@react-email/components";
import type { BeatSpec } from "../../shared/types";

interface Props {
  spec: BeatSpec;
  issueDate: string;
  issueNumber: number;
  subject: string;
  dek: string;
}

export function NewsletterHeader({ spec, issueDate, issueNumber, subject, dek }: Props) {
  return (
    <Section className="border-b border-solid border-gray-200 pb-4 mb-6">
      <Text className="m-0 text-xs uppercase tracking-wider text-gray-500">
        {spec.title} — Issue #{issueNumber} · {issueDate}
      </Text>
      <Heading as="h1" className="mt-2 mb-1 text-2xl font-bold text-gray-900">
        {subject}
      </Heading>
      <Text className="m-0 text-base text-gray-600">{dek}</Text>
    </Section>
  );
}
