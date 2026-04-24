import { Hr, Link, Section, Text } from "@react-email/components";

interface Props {
  unsubscribeUrl: string;
  dashboardUrl: string;
  coverageNote?: string;
}

export function NewsletterFooter({ unsubscribeUrl, dashboardUrl, coverageNote }: Props) {
  return (
    <Section className="mt-8 pt-4">
      <Hr className="border-gray-200 my-4" />
      {coverageNote ? (
        <Text className="text-xs text-gray-500 italic m-0 mb-3">{coverageNote}</Text>
      ) : null}
      <Text className="text-xs text-gray-500 m-0">
        <Link href={dashboardUrl} className="text-gray-500 underline">
          Dashboard
        </Link>
        {" · "}
        <Link href={`${dashboardUrl}?action=pause`} className="text-gray-500 underline">
          Pause
        </Link>
        {" · "}
        <Link href={unsubscribeUrl} className="text-gray-500 underline">
          Unsubscribe
        </Link>
      </Text>
      <Text className="text-xs text-gray-400 m-0 mt-2">
        Personal Newsroom · delivered by your agent
      </Text>
    </Section>
  );
}
