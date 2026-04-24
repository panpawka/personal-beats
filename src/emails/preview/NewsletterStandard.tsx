import NewsletterEmail from "../NewsletterEmail";
import { fixtureSpec, fixtureStandardIssue } from "../fixtures/common";

export default function NewsletterStandard() {
  return (
    <NewsletterEmail
      spec={fixtureSpec("standard")}
      issue={fixtureStandardIssue}
      issueNumber={42}
      unsubscribeUrl="https://example.com/unsubscribe/abc"
      dashboardUrl="https://example.com/dashboard"
    />
  );
}
