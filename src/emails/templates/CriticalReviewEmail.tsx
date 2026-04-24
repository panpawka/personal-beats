import React from 'react';
import { Text } from 'react-email';
import { EmailTemplateLayout } from '../components/EmailTemplateLayout';
import {
  EmailH1,
  EmailH2,
  EmailLead,
  EmailBody,
  EmailButton,
  EmailOverline,
  EmailSectionCard,
  EmailPill,
} from '../components/primitives';
import { COLOR, FONT_SANS, SPACE } from '../components/tokens';

export type CriticalReview = {
  text: string;
  rating: number;
  author: string;
  timestamp: string;
};

export type CriticalReviewBusinessGroup = {
  businessName: string;
  reviews: CriticalReview[];
};

export type CriticalReviewEmailProps = {
  userId: string;
  businesses: CriticalReviewBusinessGroup[];
  unsubscribeUrl: string;
};

function Stars({ rating }: { rating: number }) {
  const clamped = Math.max(0, Math.min(5, rating));
  return (
    <span
      aria-label={`${clamped} z 5 gwiazdek`}
      style={{
        font: `600 13px/1 ${FONT_SANS}`,
        letterSpacing: '0.04em',
        color: COLOR.danger,
        fontVariantNumeric: 'tabular-nums',
      }}>
      <span style={{ color: COLOR.danger }}>{'★'.repeat(clamped)}</span>
      <span style={{ color: COLOR.border }}>{'★'.repeat(5 - clamped)}</span>
    </span>
  );
}

function truncate(text: string, max: number) {
  return text.length > max ? text.slice(0, max) + '…' : text;
}

export function CriticalReviewEmail({
  userId: _userId,
  businesses,
  unsubscribeUrl,
}: CriticalReviewEmailProps) {
  const totalReviews = businesses.reduce((sum, b) => sum + b.reviews.length, 0);
  const isMulti = businesses.length > 1;

  const subtitle = isMulti
    ? `${businesses.length} lokalizacje`
    : businesses[0]?.businessName ?? '';

  const title = isMulti
    ? `Krytyczne opinie — ${businesses.length} lokalizacje`
    : `Krytyczne opinie — ${businesses[0]?.businessName ?? ''}`;

  const previewText = `${totalReviews} ${
    totalReviews === 1 ? 'nowa krytyczna opinia' : 'nowe krytyczne opinie'
  } wymaga${totalReviews === 1 ? '' : 'ją'} odpowiedzi.`;

  return (
    <EmailTemplateLayout
      title={title}
      previewText={previewText}
      eyebrow="Krytyczne opinie"
      subtitle={subtitle}
      unsubscribeUrl={unsubscribeUrl}>
      <EmailH1>Krytyczne opinie wymagają uwagi.</EmailH1>
      <EmailLead>
        Pojawiło się <strong>{totalReviews}</strong>{' '}
        {totalReviews === 1 ? 'nowa negatywna opinia' : 'nowych negatywnych opinii'}{' '}
        {isMulti
          ? `w ${businesses.length} Twoich lokalizacjach`
          : `w Twojej lokalizacji ${businesses[0]?.businessName ?? ''}`}
        . Im szybciej odpowiesz, tym mniejszy wpływ na ocenę.
      </EmailLead>

      <EmailSectionCard tone="danger" accentBar>
        <EmailH2>Dlaczego to pilne</EmailH2>
        <EmailBody>
          Opinie z oceną 1–2★ obniżają średnią trzy razy bardziej niż pochwały
          ją podnoszą. Profesjonalna odpowiedź w ciągu 24 godzin zatrzymuje
          odpływ klientów.
        </EmailBody>
      </EmailSectionCard>

      {businesses.map((group) => (
        <React.Fragment key={group.businessName}>
          <EmailOverline>
            {isMulti
              ? `${group.businessName} — ${group.reviews.length} ${
                  group.reviews.length === 1 ? 'opinia' : 'opinie'
                }`
              : 'Ostatnie zgłoszenia'}
          </EmailOverline>

          {group.reviews.map((review, idx) => (
            <EmailSectionCard key={`${group.businessName}-${idx}`} tone="danger" accentBar>
              <table
                role="presentation"
                cellPadding={0}
                cellSpacing={0}
                width="100%"
                style={{ borderCollapse: 'collapse', marginBottom: SPACE.sm }}>
                <tbody>
                  <tr>
                    <td style={{ verticalAlign: 'middle' }}>
                      <Stars rating={review.rating} />
                    </td>
                    <td style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                      <EmailPill tone="danger">{review.rating}/5</EmailPill>
                    </td>
                  </tr>
                </tbody>
              </table>
              <Text
                style={{
                  margin: `0 0 ${SPACE.sm}`,
                  font: `400 14px/1.6 ${FONT_SANS}`,
                  color: COLOR.fg,
                  fontStyle: 'italic',
                }}>
                „{truncate(review.text, 180)}”
              </Text>
              <div
                style={{
                  font: `500 12px/1.4 ${FONT_SANS}`,
                  color: COLOR.fgMuted,
                }}>
                {review.author} · {review.timestamp}
              </div>
            </EmailSectionCard>
          ))}
        </React.Fragment>
      ))}

      <EmailButton href="/dashboard">Odpowiedz z Feednode</EmailButton>
    </EmailTemplateLayout>
  );
}

export default CriticalReviewEmail;
