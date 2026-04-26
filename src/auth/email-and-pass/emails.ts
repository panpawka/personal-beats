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
    text: [
      'Confirm your email to activate your Personal Beats account:',
      '',
      verificationLink,
      '',
      "Link expires in 24 hours. Didn't sign up? Ignore this message.",
      '',
      '— Personal Beats',
    ].join('\n'),
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
    text: [
      'Reset your Personal Beats password:',
      '',
      passwordResetLink,
      '',
      "Link expires in 1 hour. If this wasn't you, ignore this message — your password stays unchanged.",
      '',
      '— Personal Beats',
    ].join('\n'),
    html,
  };
};
