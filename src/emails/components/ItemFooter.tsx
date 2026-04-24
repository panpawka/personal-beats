import { Link, Section, Text } from "@react-email/components";

interface Props {
  feedbackUpUrl?: string;
  feedbackDownUrl?: string;
}

export function ItemFooter({ feedbackUpUrl, feedbackDownUrl }: Props) {
  if (!feedbackUpUrl && !feedbackDownUrl) return null;
  return (
    <Section className="mt-3">
      <Text className="m-0 text-xs text-gray-500">
        Was this useful?{" "}
        {feedbackUpUrl ? (
          <Link href={feedbackUpUrl} className="text-gray-700 underline mr-2">
            👍 Yes
          </Link>
        ) : null}
        {feedbackDownUrl ? (
          <Link href={feedbackDownUrl} className="text-gray-700 underline">
            👎 Not really
          </Link>
        ) : null}
      </Text>
    </Section>
  );
}
