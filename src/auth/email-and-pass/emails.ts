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
    subject: 'Verify your email — Personal Beats',
    text: `Click the link below to verify your email:\n\n${verificationLink}\n\nIf you didn't sign up for Personal Beats, ignore this message.`,
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
    subject: 'Reset your password — Personal Beats',
    text: `Click the link below to reset your password:\n\n${passwordResetLink}\n\nThis link expires in 1 hour. If you didn't request a reset, ignore this message.`,
    html,
  };
};
