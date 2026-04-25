import { Link, Section, Text } from "@react-email/components";
import { useEmailT } from "../i18n";

interface Props {
  feedbackUpUrl?: string;
  feedbackDownUrl?: string;
}

export function ItemFooter({ feedbackUpUrl, feedbackDownUrl }: Props) {
  const t = useEmailT();
  if (!feedbackUpUrl && !feedbackDownUrl) return null;
  return (
    <Section className="mt-3">
      <Text className="m-0 text-xs text-gray-500">
        {t("wasUseful")}{" "}
        {feedbackUpUrl ? (
          <Link href={feedbackUpUrl} className="text-gray-700 underline mr-2">
            {t("yes")}
          </Link>
        ) : null}
        {feedbackDownUrl ? (
          <Link href={feedbackDownUrl} className="text-gray-700 underline">
            {t("notReally")}
          </Link>
        ) : null}
      </Text>
    </Section>
  );
}
