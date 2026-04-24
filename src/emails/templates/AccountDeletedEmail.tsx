import React from 'react';
import { EmailTemplateLayout } from '../components/EmailTemplateLayout';
import {
  EmailH1,
  EmailLead,
  EmailSmall,
  EmailInlineLink,
} from '../components/primitives';

export type AccountDeletedEmailProps = {
  userEmail: string;
};

export function AccountDeletedEmail({ userEmail }: AccountDeletedEmailProps) {
  return (
    <EmailTemplateLayout
      title="Konto usunięte — Feednode"
      previewText="Twoje konto Feednode zostało usunięte."
      eyebrow="Konto"
      subtitle={userEmail}>
      <EmailH1>Konto zostało usunięte.</EmailH1>
      <EmailLead>
        Zgodnie z prośbą Twoje konto Feednode zostało usunięte. Wszystkie dane
        powiązane z adresem <strong>{userEmail}</strong> zostały wyczyszczone z
        naszych serwerów.
      </EmailLead>
      <EmailSmall>
        Jeśli to była pomyłka lub zmieniłeś zdanie, napisz do nas w ciągu 30 dni:{' '}
        <EmailInlineLink href="mailto:pomoc@feednode.app">pomoc@feednode.app</EmailInlineLink>
      </EmailSmall>
      <EmailSmall>Dziękujemy, że byłeś z nami.</EmailSmall>
    </EmailTemplateLayout>
  );
}

export default AccountDeletedEmail;
