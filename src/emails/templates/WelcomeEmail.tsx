import React from 'react';
import { EmailTemplateLayout } from '../components/EmailTemplateLayout';
import {
  EmailAccent,
  EmailButton,
  EmailH1,
  EmailInlineLink,
  EmailLead,
  EmailSmall,
} from '../components/primitives';

export type WelcomeEmailProps = {
  userEmail: string;
  dashboardUrl: string;
};

export function WelcomeEmail({ userEmail, dashboardUrl }: WelcomeEmailProps) {
  return (
    <EmailTemplateLayout
      title="Welcome to Personal Beats"
      previewText="Your account is ready. Open the dashboard to design your first beat."
      eyebrow="Welcome">
      <EmailH1>
        Welcome to your <EmailAccent>newsroom</EmailAccent>.
      </EmailH1>
      <EmailLead>
        Your account ({userEmail}) is ready. Personal Beats files briefs shaped
        to your life — you tell us what to watch, our agents design the beat,
        and issues land on your schedule.
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
