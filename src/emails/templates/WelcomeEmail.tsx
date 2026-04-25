import React from 'react';
import { EmailTemplateLayout } from '../components/EmailTemplateLayout';
import {
  EmailH1,
  EmailLead,
  EmailButton,
  EmailSmall,
  EmailInlineLink,
} from '../components/primitives';

export type WelcomeEmailProps = {
  userEmail: string;
  dashboardUrl: string;
};

export function WelcomeEmail({ userEmail, dashboardUrl }: WelcomeEmailProps) {
  return (
    <EmailTemplateLayout
      title="Welcome to Personal Newsroom"
      previewText="Your account is ready. Open the dashboard to design your first beat."
      eyebrow="Welcome">
      <EmailH1>Welcome to Personal Newsroom.</EmailH1>
      <EmailLead>
        Your account ({userEmail}) is ready. Personal Newsroom files briefs
        shaped to your life — you tell us what to watch, our agents design the
        beat, and issues land on your schedule.
      </EmailLead>
      <EmailButton href={dashboardUrl}>Open dashboard</EmailButton>
      <EmailSmall>
        Button not working? Open this link:{' '}
        <EmailInlineLink href={dashboardUrl}>{dashboardUrl}</EmailInlineLink>
      </EmailSmall>
    </EmailTemplateLayout>
  );
}

export default WelcomeEmail;
