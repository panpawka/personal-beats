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
      title="Reset hasła — Feednode"
      previewText="Kliknij, aby ustawić nowe hasło. Link ważny 1 godzinę."
      eyebrow="Bezpieczeństwo konta">
      <EmailH1>Zresetuj hasło</EmailH1>
      <EmailLead>
        Ktoś — prawdopodobnie Ty — poprosił o reset hasła do Twojego konta
        Feednode. Kliknij przycisk poniżej, aby ustawić nowe hasło.
      </EmailLead>
      <EmailButton href={passwordResetLink}>Zresetuj hasło</EmailButton>
      <EmailSmall>
        Link wygasa po 1 godzinie. Jeśli to nie Ty, zignoruj tę wiadomość — Twoje
        hasło pozostanie bez zmian.
      </EmailSmall>
      <EmailSmall>
        Przycisk nie działa? Skopiuj link:{' '}
        <EmailInlineLink href={passwordResetLink}>{passwordResetLink}</EmailInlineLink>
      </EmailSmall>
    </EmailTemplateLayout>
  );
}

export default PasswordResetEmail;
