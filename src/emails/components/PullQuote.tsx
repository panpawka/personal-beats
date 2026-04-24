import { Section, Text } from "@react-email/components";

interface Props {
  quote: string;
  attribution?: string;
}

export function PullQuote({ quote, attribution }: Props) {
  return (
    <Section className="my-4 pl-4 border-l-4 border-solid border-gray-900">
      <Text className="m-0 text-base italic text-gray-900 leading-6">
        “{quote}”
      </Text>
      {attribution ? (
        <Text className="m-0 mt-1 text-xs text-gray-500">— {attribution}</Text>
      ) : null}
    </Section>
  );
}
