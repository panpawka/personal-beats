import * as React from "react";
import { render } from "@react-email/components";
import NewsletterBrief from "../src/emails/preview/NewsletterBrief";
import NewsletterStandard from "../src/emails/preview/NewsletterStandard";
import NewsletterDeep from "../src/emails/preview/NewsletterDeep";

const cases = [
  ["brief", NewsletterBrief],
  ["standard", NewsletterStandard],
  ["deep", NewsletterDeep],
] as const;

for (const [name, Comp] of cases) {
  const html = await render(<Comp />);
  const text = await render(<Comp />, { plainText: true });
  console.log(`${name.padEnd(8)} html=${html.length}  text=${text.length}`);
  if (html.length < 1000) throw new Error(`${name}: html suspiciously short`);
  if (text.length < 200) throw new Error(`${name}: plain-text suspiciously short`);
  if (!html.includes("Wrocław")) throw new Error(`${name}: missing expected content in html`);
  if (!text.includes("Wrocław")) throw new Error(`${name}: missing expected content in text`);
}

console.log("OK — all three depths render to HTML and plain text.");
