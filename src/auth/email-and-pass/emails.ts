import React from 'react';
import { type GetVerificationEmailContentFn, type GetPasswordResetEmailContentFn } from 'wasp/server/auth';
import { renderEmailSync } from '../../emails/render';
import { VerificationEmail } from '../../emails/templates/VerificationEmail';
import { PasswordResetEmail } from '../../emails/templates/PasswordResetEmail';

export const getVerificationEmailContent: GetVerificationEmailContentFn = ({ verificationLink }) => {
  let html = '';
  try {
    html = renderEmailSync(React.createElement(VerificationEmail, { verificationLink }));
  } catch (err) {
    console.error('VerificationEmail render failed', err);
    // html stays '' — SendGrid will deliver text-only fallback
  }
  return {
    subject: 'Zweryfikuj swój adres e-mail — Feednode',
    text: `Kliknij poniższy link, aby zweryfikować swój adres e-mail:\n\n${verificationLink}\n\nJeśli nie zakładałeś konta w Feednode, zignoruj tę wiadomość.`,
    html,
  };
};

export const getPasswordResetEmailContent: GetPasswordResetEmailContentFn = ({ passwordResetLink }) => {
  let html = '';
  try {
    html = renderEmailSync(React.createElement(PasswordResetEmail, { passwordResetLink }));
  } catch (err) {
    console.error('PasswordResetEmail render failed', err);
  }
  return {
    subject: 'Resetowanie hasła — Feednode',
    text: `Kliknij poniższy link, aby zresetować hasło:\n\n${passwordResetLink}\n\nLink jest ważny przez 1 godzinę. Jeśli nie prosiłeś o reset hasła, zignoruj tę wiadomość.`,
    html,
  };
};
