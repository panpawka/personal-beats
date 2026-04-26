import * as React from "react";
import { Section, Text } from "@react-email/components";
import { useEmailT } from "../i18n";
import { EDITORIAL, FONT_MONO, FONT_SERIF } from "./tokens";

export function EditorsNote({ children }: { children: React.ReactNode }) {
  const t = useEmailT();
  return (
    <Section
      style={{
        backgroundColor: EDITORIAL.paper2,
        borderLeft: `2px solid ${EDITORIAL.accent}`,
        padding: "14px 18px",
        margin: "0 0 24px",
      }}
    >
      <Text
        style={{
          margin: "0 0 6px",
          fontFamily: FONT_MONO,
          fontSize: "9.5px",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: EDITORIAL.accentInk,
          fontWeight: 600,
        }}
      >
        {t("editorsNote")}
      </Text>
      <Text
        style={{
          margin: 0,
          fontFamily: FONT_SERIF,
          fontSize: 15,
          lineHeight: 1.4,
          color: EDITORIAL.ink2,
        }}
      >
        {children}
      </Text>
    </Section>
  );
}
