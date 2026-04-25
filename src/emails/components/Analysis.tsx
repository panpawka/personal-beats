import { Section, Text } from "@react-email/components";
import { useEmailT } from "../i18n";

interface Props {
  label?: "Analysis" | "Context";
  children: React.ReactNode;
}

export function Analysis({ label = "Analysis", children }: Props) {
  const t = useEmailT();
  const localized = label === "Context" ? t("context") : t("analysis");
  return (
    <Section className="bg-gray-50 border-l-4 border-solid border-gray-400 pl-4 py-3 my-4">
      <Text className="m-0 text-xs uppercase tracking-wider text-gray-500 font-semibold">
        {localized}
      </Text>
      <Text className="m-0 text-sm text-gray-800 leading-6">{children}</Text>
    </Section>
  );
}
