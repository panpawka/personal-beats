import * as React from "react";
import { Body, Container, Font, Head, Html, Preview } from "@react-email/components";
import { DeepLayout } from "./layouts/DeepLayout";
import type { NewsletterEmailProps } from "./types";
import { EmailLocaleProvider, isEmailLocale } from "./i18n";
import { EDITORIAL, FONT_SANS } from "./components/tokens";

export function NewsletterEmail(props: NewsletterEmailProps) {
  const { spec, issue } = props;
  const locale = isEmailLocale(spec.output_language) ? spec.output_language : "en";

  return (
    <EmailLocaleProvider value={locale}>
      <Html lang={locale}>
        <Head>
          <Font
            fontFamily="Source Serif 4"
            fallbackFontFamily="Georgia"
            webFont={{
              url: "https://fonts.gstatic.com/s/sourceserif4/v8/vEFy2_tTDB4M7-auWDN0ahZJW1ge6OZw.woff2",
              format: "woff2",
            }}
            fontWeight={400}
            fontStyle="normal"
          />
          <Font
            fontFamily="Source Serif 4"
            fallbackFontFamily="Georgia"
            webFont={{
              url: "https://fonts.gstatic.com/s/sourceserif4/v8/vEFy2_tTDB4M7-auWDN0ahZJW1geyOZw.woff2",
              format: "woff2",
            }}
            fontWeight={400}
            fontStyle="italic"
          />
          <Font
            fontFamily="JetBrains Mono"
            fallbackFontFamily="monospace"
            webFont={{
              url: "https://fonts.gstatic.com/s/jetbrainsmono/v22/tDbY2o-flEEny0FZhsfKu5WU4xD-IQ-PuZJJXxfpAO-Lf1OQk6OK.woff2",
              format: "woff2",
            }}
            fontWeight={400}
            fontStyle="normal"
          />
        </Head>
        <Preview>{issue.dek}</Preview>
        <Body
          style={{
            backgroundColor: EDITORIAL.frameBg,
            margin: 0,
            padding: "32px 16px 56px",
            fontFamily: FONT_SANS,
            color: EDITORIAL.ink,
          }}
        >
          <Container
            style={{
              maxWidth: 640,
              margin: "0 auto",
              backgroundColor: EDITORIAL.paper,
              border: `1px solid ${EDITORIAL.rule}`,
              boxShadow: "0 8px 32px -12px rgba(0,0,0,0.18)",
              padding: 0,
            }}
          >
            <DeepLayout {...props} />
          </Container>
        </Body>
      </Html>
    </EmailLocaleProvider>
  );
}

export default NewsletterEmail;
