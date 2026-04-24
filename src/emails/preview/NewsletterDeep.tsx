import NewsletterEmail from "../NewsletterEmail";
import { fixtureDeepIssue, fixtureSpec } from "../fixtures/common";

export default function NewsletterDeep() {
  return (
    <NewsletterEmail
      spec={fixtureSpec("deep")}
      issue={fixtureDeepIssue}
      issueNumber={7}
      unsubscribeUrl="https://example.com/unsubscribe/abc"
      dashboardUrl="https://example.com/dashboard"
    />
  );
}
