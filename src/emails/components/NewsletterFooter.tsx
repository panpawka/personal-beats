import * as React from "react";
import { Link, Section, Text } from "@react-email/components";
import { useEmailT } from "../i18n";
import { EDITORIAL, FONT_MONO } from "./tokens";

interface Props {
  unsubscribeUrl: string;
  dashboardUrl: string;
}

const FOOT_STYLE: React.CSSProperties = {
  padding: "26px 36px 30px",
  borderTop: `2px solid ${EDITORIAL.ink}`,
  textAlign: "center",
};

const LINKS_STYLE: React.CSSProperties = {
  margin: 0,
  fontFamily: FONT_MONO,
  fontSize: 10.5,
  letterSpacing: "0.06em",
  color: EDITORIAL.ink3,
};

const LINK_STYLE: React.CSSProperties = {
  color: EDITORIAL.ink2,
  textDecoration: "underline",
  textUnderlineOffset: 2,
};

const BRAND_STYLE: React.CSSProperties = {
  margin: "10px 0 0",
  fontFamily: FONT_MONO,
  fontSize: 10,
  letterSpacing: "0.08em",
  color: EDITORIAL.ink4,
};

export function NewsletterFooter({ unsubscribeUrl, dashboardUrl }: Props) {
  const t = useEmailT();
  return (
    <Section style={FOOT_STYLE}>
      <Text style={LINKS_STYLE}>
        <Link href={dashboardUrl} style={LINK_STYLE}>
          {t("dashboard")}
        </Link>
        {"  ·  "}
        <Link href={`${dashboardUrl}?action=pause`} style={LINK_STYLE}>
          {t("pause")}
        </Link>
        {"  ·  "}
        <Link href={unsubscribeUrl} style={LINK_STYLE}>
          {t("unsubscribe")}
        </Link>
      </Text>
      <Text style={BRAND_STYLE}>{t("deliveredBy")}</Text>
    </Section>
  );
}
