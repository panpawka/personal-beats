import { Body, Container, Head, Html, Preview, Tailwind } from "@react-email/components";
import { BriefLayout } from "./layouts/BriefLayout";
import { StandardLayout } from "./layouts/StandardLayout";
import { DeepLayout } from "./layouts/DeepLayout";
import type { NewsletterEmailProps } from "./types";
import { EmailLocaleProvider, isEmailLocale } from "./i18n";

export function NewsletterEmail(props: NewsletterEmailProps) {
  const { spec, issue } = props;
  const Layout =
    spec.depth === "brief" ? BriefLayout : spec.depth === "deep" ? DeepLayout : StandardLayout;
  const locale = isEmailLocale(spec.output_language) ? spec.output_language : "en";

  return (
    <EmailLocaleProvider value={locale}>
      <Html lang={locale}>
        <Head />
        <Preview>{issue.dek}</Preview>
        <Tailwind>
          <Body className="bg-gray-50 font-sans m-0 p-0">
            <Container className="max-w-[640px] mx-auto p-6 bg-white">
              <Layout {...props} />
            </Container>
          </Body>
        </Tailwind>
      </Html>
    </EmailLocaleProvider>
  );
}

export default NewsletterEmail;
