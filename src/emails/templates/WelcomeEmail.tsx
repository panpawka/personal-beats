import React from 'react';
import { EmailTemplateLayout } from '../components/EmailTemplateLayout';
import {
  EmailH1,
  EmailH2,
  EmailLead,
  EmailBody,
  EmailButton,
  EmailSectionCard,
  EmailOverline,
} from '../components/primitives';
import { COLOR, FONT_SANS, SPACE } from '../components/tokens';

export type WelcomeEmailProps = {
  userEmail: string;
  dashboardUrl: string;
};

const STEPS: Array<{ n: string; title: string; body: string }> = [
  {
    n: '01',
    title: 'Podłącz Google My Business',
    body: 'Jedno logowanie OAuth — importujemy wszystkie lokalizacje i historię opinii.',
  },
  {
    n: '02',
    title: 'Nauczmy agenta Twojego tonu',
    body: 'Pokaż 3–5 wzorcowych odpowiedzi. Agent dopasuje rejestr i długość.',
  },
  {
    n: '03',
    title: 'Akceptuj lub publikuj automatycznie',
    body: 'Tryb ręczny z kolejką albo pełna automatyka z progiem jakości.',
  },
];

export function WelcomeEmail({ userEmail, dashboardUrl }: WelcomeEmailProps) {
  return (
    <EmailTemplateLayout
      title="Witaj w Feednode"
      previewText="Konto gotowe. Podłącz Google My Business w kwadrans."
      eyebrow="Start"
      subtitle={userEmail}>
      <EmailH1>Witaj w Feednode.</EmailH1>
      <EmailLead>
        Twoje konto jest gotowe. Agent czeka na opinie — wystarczy, że podłączysz
        swoją lokalizację Google. Konfiguracja zajmuje ok. 15 minut.
      </EmailLead>
      <EmailButton href={dashboardUrl}>Otwórz panel</EmailButton>

      <EmailOverline>Twoje pierwsze kroki</EmailOverline>
      {STEPS.map((s) => (
        <EmailSectionCard key={s.n}>
          <table
            role="presentation"
            cellPadding={0}
            cellSpacing={0}
            width="100%"
            style={{ borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td
                  style={{
                    width: '44px',
                    verticalAlign: 'top',
                    font: `800 20px/1 ${FONT_SANS}`,
                    color: COLOR.brand,
                    letterSpacing: '-0.02em',
                    paddingTop: '2px',
                  }}>
                  {s.n}
                </td>
                <td style={{ verticalAlign: 'top' }}>
                  <EmailH2>{s.title}</EmailH2>
                  <EmailBody>{s.body}</EmailBody>
                </td>
              </tr>
            </tbody>
          </table>
        </EmailSectionCard>
      ))}

      <EmailSectionCard tone="accent" accentBar>
        <EmailH2>Pytania? Jesteśmy pod ręką.</EmailH2>
        <EmailBody>
          Napisz na{' '}
          <a
            href="mailto:czesc@lemonode.pl"
            style={{
              color: COLOR.accent700,
              textDecoration: 'underline',
              fontWeight: 600,
            }}>
            czesc@lemonode.pl
          </a>{' '}
          — odpowiadamy tego samego dnia, po polsku.
        </EmailBody>
      </EmailSectionCard>
    </EmailTemplateLayout>
  );
}

export default WelcomeEmail;
