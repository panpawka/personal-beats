import React from 'react';
import { EmailTemplateLayout } from '../components/EmailTemplateLayout';
import {
  EmailH1,
  EmailLead,
  EmailBody,
  EmailButton,
  EmailSectionCard,
  EmailOverline,
  EmailPill,
} from '../components/primitives';
import { COLOR, FONT_SANS, SPACE } from '../components/tokens';

export type SubscriptionCancelEmailProps = {
  userName: string;
  planName: string;
  accessEndDate: string;
};

const FACTS: Array<{ label: string; body: string }> = [
  {
    label: 'Pełny dostęp do końca okresu',
    body: 'Do daty wygaśnięcia korzystasz ze wszystkich funkcji planu bez zmian.',
  },
  {
    label: 'Po wygaśnięciu — plan bezpłatny',
    body: 'Konto automatycznie przejdzie na plan darmowy. Nie obciążamy karty ponownie.',
  },
  {
    label: 'Dane zostają u Ciebie',
    body: 'Opinie, odpowiedzi i historia rozmów pozostaną na Twoim koncie.',
  },
];

export function SubscriptionCancelEmail({
  userName,
  planName,
  accessEndDate,
}: SubscriptionCancelEmailProps) {
  return (
    <EmailTemplateLayout
      title="Anulowano subskrypcję — Feednode"
      previewText={`Subskrypcja ${planName} wygasa ${accessEndDate}.`}
      eyebrow="Rozliczenia"
      subtitle={`Anulowanie subskrypcji · plan ${planName}`}>
      <EmailH1>Cześć {userName},</EmailH1>
      <EmailLead>
        Potwierdzamy anulowanie Twojej subskrypcji Feednode. Nie musisz nic
        robić — dalsze płatności zostały wstrzymane.
      </EmailLead>

      <EmailSectionCard tone="accent" accentBar>
        <table
          role="presentation"
          cellPadding={0}
          cellSpacing={0}
          width="100%"
          style={{ borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td>
                <EmailOverline>Plan</EmailOverline>
                <div
                  style={{
                    font: `700 18px/1.2 ${FONT_SANS}`,
                    color: COLOR.accent800,
                    letterSpacing: '-0.01em',
                  }}>
                  {planName}
                </div>
              </td>
              <td style={{ textAlign: 'right', verticalAlign: 'top' }}>
                <div style={{ marginBottom: SPACE.xs }}>
                  <EmailPill tone="amber">Wygasa {accessEndDate}</EmailPill>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </EmailSectionCard>

      <EmailOverline>Co się teraz stanie</EmailOverline>
      {FACTS.map((f) => (
        <EmailSectionCard key={f.label}>
          <div
            style={{
              font: `600 13px/1.4 ${FONT_SANS}`,
              color: COLOR.fg,
              marginBottom: SPACE.xs,
            }}>
            {f.label}
          </div>
          <EmailBody>{f.body}</EmailBody>
        </EmailSectionCard>
      ))}

      <EmailButton href="/dashboard" variant="outline">
        Zarządzaj subskrypcją
      </EmailButton>
    </EmailTemplateLayout>
  );
}

export default SubscriptionCancelEmail;
