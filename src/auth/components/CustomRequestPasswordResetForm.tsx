import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLingui } from '@lingui/react/macro';
import { requestPasswordReset } from 'wasp/client/auth';
import { routes } from 'wasp/client/router';
import { translateAuthError } from '../utils/errorMessages';
import { AuthStatusCard } from './AuthStatusCard';

export function CustomRequestPasswordResetForm() {
    const { t, i18n } = useLingui();
    const [error, setError] = useState<string | null>(null);
    const [needsConfirmation, setNeedsConfirmation] = useState(false);

    const resetRequestSchema = z.object({
        email: z.string().email(t`Invalid email format`),
    });

    type ResetRequestFormData = z.infer<typeof resetRequestSchema>;

    const form = useForm<ResetRequestFormData>({
        resolver: zodResolver(resetRequestSchema),
        defaultValues: { email: '' },
    });

    async function onSubmit(data: ResetRequestFormData) {
        setError(null);
        try {
            await requestPasswordReset({ email: data.email });
            setNeedsConfirmation(true);
        } catch (err: unknown) {
            setError(translateAuthError(err as Error, i18n));
        }
    }

    if (needsConfirmation) {
        return (
            <AuthStatusCard
                tone="mail"
                label={t`To send`}
                title={t`Check your email`}
                description={t`If an account with that address exists, we sent a password reset link.`}
                action={{ label: t`Back to sign in`, to: routes.LoginPageRoute.to }}
            />
        );
    }

    const submitting = form.formState.isSubmitting;

    return (
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="auth-form">
            {error && <div className="editorial-error" role="alert">{error}</div>}

            <Controller
                name="email"
                control={form.control}
                render={({ field, fieldState }) => (
                    <div className="auth-field">
                        <label htmlFor="email">{t`Email`}</label>
                        <input
                            {...field}
                            id="email"
                            type="email"
                            placeholder={t`you@company.com`}
                            autoComplete="email"
                            aria-invalid={fieldState.invalid}
                            disabled={submitting}
                            className="auth-input"
                        />
                        {fieldState.error && (
                            <span className="auth-field-err">{fieldState.error.message}</span>
                        )}
                    </div>
                )}
            />

            <button type="submit" disabled={submitting} className="auth-submit">
                {submitting ? t`Sending…` : t`Send reset link →`}
            </button>
        </form>
    );
}
