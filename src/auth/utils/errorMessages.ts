import { msg } from '@lingui/core/macro';
import type { I18n } from '@lingui/core';
import type { MessageDescriptor } from '@lingui/core';

/**
 * Map English error keys (as emitted by Wasp's auth pipeline) to translatable
 * MessageDescriptors. Both the lookup key and the descriptor's `id` use the
 * English text — Lingui then renders the active-locale translation.
 */
const ERROR_DESCRIPTORS: Record<string, MessageDescriptor> = {
    'Invalid credentials': msg`Invalid email or password`,
    'Invalid credentials.': msg`Invalid email or password`,
    'User with this email already exists': msg`A user with this email already exists`,
    'Email is not verified': msg`Your email is not verified`,
    'Invalid token': msg`Invalid or expired token`,
    'Token not found in URL': msg`Missing verification token in the link`,
    'Password must be at least 8 characters': msg`Password must be at least 8 characters`,
    'Password must be at least 8 characters long': msg`Password must be at least 8 characters`,
    'Passwords do not match': msg`Passwords do not match`,
    'Invalid email format': msg`Invalid email format`,
    'Email is required': msg`Email is required`,
    'Password is required': msg`Password is required`,
    'Network error': msg`Connection error. Check your internet connection.`,
    'Failed to fetch': msg`Connection error. Check your internet connection.`,
};

export function translateAuthError(error: Error | string, i18n: I18n): string {
    const errorMessage = typeof error === 'string' ? error : error.message;

    const exact = ERROR_DESCRIPTORS[errorMessage];
    if (exact) return i18n._(exact);

    const lower = errorMessage.toLowerCase();
    for (const [key, descriptor] of Object.entries(ERROR_DESCRIPTORS)) {
        if (lower.includes(key.toLowerCase())) {
            return i18n._(descriptor);
        }
    }

    return errorMessage;
}
