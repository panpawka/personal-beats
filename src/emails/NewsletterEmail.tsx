import { Body, Container, Head, Html, Preview, Tailwind } from "@react-email/components";
import { BriefLayout } from "./layouts/BriefLayout";
import { StandardLayout } from "./layouts/StandardLayout";
import { DeepLayout } from "./layouts/DeepLayout";
import type { NewsletterEmailProps } from "./types";

export function NewsletterEmail(props: NewsletterEmailProps) {
  const { spec, issue } = props;
  const Layout =
    spec.depth === "brief" ? BriefLayout : spec.depth === "deep" ? DeepLayout : StandardLayout;

  return (
    <Html lang={spec.output_language || "en"}>
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
  );
}

export default NewsletterEmail;
