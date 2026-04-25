import React from 'react';
import { EmailTemplateLayout } from '../components/EmailTemplateLayout';
import {
  EmailH1,
  EmailLead,
  EmailButton,
  EmailSmall,
  EmailInlineLink,
} from '../components/primitives';

export type VerificationEmailProps = {
  verificationLink: string;
};

export function VerificationEmail({ verificationLink }: VerificationEmailProps) {
  return (
    <EmailTemplateLayout
      title="Verify your email — Personal Newsroom"
      previewText="Verify your email to activate your account."
      eyebrow="Account verification">
      <EmailH1>Verify your email</EmailH1>
      <EmailLead>
        Confirm your email address to activate your Personal Newsroom account
        and start receiving your beats.
      </EmailLead>
      <EmailButton href={verificationLink}>Verify email</EmailButton>
      <EmailSmall>
        Button not working? Copy and paste this link:{' '}
        <EmailInlineLink href={verificationLink}>{verificationLink}</EmailInlineLink>
      </EmailSmall>
      <EmailSmall>
        This link expires in 24 hours. Didn't sign up? Ignore this message.
      </EmailSmall>
    </EmailTemplateLayout>
  );
}

export default VerificationEmail;
