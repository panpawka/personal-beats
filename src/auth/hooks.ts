import React from 'react';
import { HttpError } from 'wasp/server';
import { emailSender } from 'wasp/server/email';
import type { OnAfterSignupHook, OnAfterEmailVerifiedHook } from 'wasp/server/auth';
import { renderEmail } from '../emails/render';
import { WelcomeEmail } from '../emails/templates/WelcomeEmail';

function dashboardUrl(): string {
  const base = (process.env.WASP_WEB_CLIENT_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  return `${base}/dashboard`;
}

async function sendWelcomeEmail(to: string): Promise<void> {
  const url = dashboardUrl();
  const html = await renderEmail(
    React.createElement(WelcomeEmail, { userEmail: to, dashboardUrl: url })
  );
  await emailSender.send({
    to,
    subject: 'Welcome to Personal Newsroom',
    text: `Your account is ready. Open the dashboard: ${url}`,
    html,
  });
}

export const onAfterSignup: OnAfterSignupHook = async ({ providerId, user, prisma }) => {
  // For Stripe to function correctly, we need a valid email associated with the user.
  // Discord allows an email address to be optional. If this is the case, we delete the user
  // from our DB and throw an error.
  if (providerId.providerName === 'discord' && !user.email) {
    await prisma.user.delete({
      where: {
        id: user.id,
      },
    });
    throw new HttpError(403, 'Discord user needs a valid email to sign up');
  }

  // Google users skip email verification — send welcome email immediately.
  // email/pass users get the welcome email from onAfterEmailVerified instead.
  if (providerId.providerName === 'google' && user.email) {
    try {
      await sendWelcomeEmail(user.email);
    } catch (err) {
      console.error('Welcome email send failed after Google signup', err);
      // Do NOT bubble up — signup must succeed even if email fails
    }
  }
};

export const onAfterEmailVerified: OnAfterEmailVerifiedHook = async ({ email }) => {
  try {
    await sendWelcomeEmail(email);
  } catch (err) {
    // Log but do NOT bubble up — verification must succeed even if email fails
    console.error('Welcome email send failed after email verification', err);
  }
};
