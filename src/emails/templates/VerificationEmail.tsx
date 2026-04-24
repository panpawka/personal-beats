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
      title="Zweryfikuj adres e-mail — Feednode"
      previewText="Zweryfikuj adres e-mail, aby aktywować konto."
      eyebrow="Weryfikacja konta">
      <EmailH1>Zweryfikuj swój e-mail</EmailH1>
      <EmailLead>
        Potwierdź adres e-mail, aby aktywować konto Feednode i zacząć odpowiadać
        na opinie Google w sekundy.
      </EmailLead>
      <EmailButton href={verificationLink}>Zweryfikuj e-mail</EmailButton>
      <EmailSmall>
        Przycisk nie działa? Skopiuj i wklej link:{' '}
        <EmailInlineLink href={verificationLink}>{verificationLink}</EmailInlineLink>
      </EmailSmall>
      <EmailSmall>
        Link wygasa po 24 godzinach. Nie zakładałeś konta? Zignoruj tę wiadomość.
      </EmailSmall>
    </EmailTemplateLayout>
  );
}

export default VerificationEmail;
