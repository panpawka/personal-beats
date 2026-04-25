import React from 'react';
import { EmailTemplateLayout } from '../components/EmailTemplateLayout';
import {
  EmailH1,
  EmailLead,
  EmailButton,
  EmailSmall,
  EmailInlineLink,
} from '../components/primitives';

export type PasswordResetEmailProps = {
  passwordResetLink: string;
};

export function PasswordResetEmail({ passwordResetLink }: PasswordResetEmailProps) {
  return (
    <EmailTemplateLayout
      title="Reset password — Personal Beats"
      previewText="Click to set a new password. Link valid for 1 hour."
      eyebrow="Account security">
      <EmailH1>Reset your password</EmailH1>
      <EmailLead>
        Someone — probably you — requested a password reset for your Personal
        Beats account. Click the button below to set a new password.
      </EmailLead>
      <EmailButton href={passwordResetLink}>Reset password</EmailButton>
      <EmailSmall>
        This link expires in 1 hour. If this wasn't you, ignore this message —
        your password stays unchanged.
      </EmailSmall>
      <EmailSmall>
        Button not working? Copy this link:{' '}
        <EmailInlineLink href={passwordResetLink}>{passwordResetLink}</EmailInlineLink>
      </EmailSmall>
    </EmailTemplateLayout>
  );
}

export default PasswordResetEmail;
