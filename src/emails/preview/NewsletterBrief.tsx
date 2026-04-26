import * as React from "react";
import NewsletterEmail from "../NewsletterEmail";
import { fixtureBriefIssue, fixtureSpec } from "../fixtures/common";

export default function NewsletterBrief() {
  return (
    <NewsletterEmail
      spec={fixtureSpec("brief")}
      issue={fixtureBriefIssue}
      issueNumber={12}
      unsubscribeUrl="https://example.com/unsubscribe/abc"
      dashboardUrl="https://example.com/dashboard"
    />
  );
}
