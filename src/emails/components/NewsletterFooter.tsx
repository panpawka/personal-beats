import { Hr, Link, Section, Text } from "@react-email/components";
import { useEmailT } from "../i18n";

interface Props {
  unsubscribeUrl: string;
  dashboardUrl: string;
  coverageNote?: string;
}

export function NewsletterFooter({ unsubscribeUrl, dashboardUrl, coverageNote }: Props) {
  const t = useEmailT();
  return (
    <Section className="mt-8 pt-4">
      <Hr className="border-gray-200 my-4" />
      {coverageNote ? (
        <Text className="text-xs text-gray-500 italic m-0 mb-3">{coverageNote}</Text>
      ) : null}
      <Text className="text-xs text-gray-500 m-0">
        <Link href={dashboardUrl} className="text-gray-500 underline">
          {t("dashboard")}
        </Link>
        {" · "}
        <Link href={`${dashboardUrl}?action=pause`} className="text-gray-500 underline">
          {t("pause")}
        </Link>
        {" · "}
        <Link href={unsubscribeUrl} className="text-gray-500 underline">
          {t("unsubscribe")}
        </Link>
      </Text>
      <Text className="text-xs text-gray-400 m-0 mt-2">
        {t("deliveredBy")}
      </Text>
    </Section>
  );
}
