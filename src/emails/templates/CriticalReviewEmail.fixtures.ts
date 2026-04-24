import type { CriticalReviewEmailProps } from './CriticalReviewEmail';

export const mockCriticalReviewProps: CriticalReviewEmailProps = {
  userId: 'user-abc123',
  businesses: [
    {
      businessName: 'Restauracja Pod Lipami',
      reviews: [
        {
          text: 'Obsługa była bardzo nieprzyjemna i jedzenie zimne. Zdecydowanie nie polecam tego miejsca nikomu.',
          rating: 1,
          author: 'Anna Kowalska',
          timestamp: '13 kwietnia 2026',
        },
        {
          text: 'Długi czas oczekiwania, kelner zapomniał o połowie zamówienia. Rozczarowanie.',
          rating: 2,
          author: 'Piotr Nowak',
          timestamp: '12 kwietnia 2026',
        },
      ],
    },
  ],
  unsubscribeUrl: 'https://feednode.app/unsubscribe?token=unsub-test-token',
};

// Subject reference: "⚠️ Krytyczne opinie — Restauracja Pod Lipami (2)"
