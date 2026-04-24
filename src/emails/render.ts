import { renderToStaticMarkup } from 'react-dom/server';
import { render } from 'react-email';
import React from 'react';

/**
 * Sync rendering - for use in Wasp auth hooks (emailVerification, passwordReset)
 * that require a synchronous string return.
 */
export function renderEmailSync(component: React.ReactElement): string {
  return renderToStaticMarkup(component);
}

/**
 * Async rendering - for all other email sends.
 * Uses react-email which applies inlining and HTML optimizations.
 */
export async function renderEmail(component: React.ReactElement): Promise<string> {
  return await render(component);
}
