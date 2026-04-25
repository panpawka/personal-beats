import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLingui } from '@lingui/react/macro';
import { resetPassword } from 'wasp/client/auth';
import { routes } from 'wasp/client/router';
import { translateAuthError } from '../utils/errorMessages';
import { AuthStatusCard } from './AuthStatusCard';

export function CustomPasswordResetForm() {
    const { t, i18n } = useLingui();
    const [error, setError] = useState<string | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);

    const passwordResetSchema = z
        .object({
            newPassword: z.string().min(8, t`Password must be at least 8 characters`),
            confirmPassword: z.string(),
        })
        .refine((data) => data.newPassword === data.confirmPassword, {
            message: t`Passwords do not match`,
            path: ['confirmPassword'],
        });

    type PasswordResetFormData = z.infer<typeof passwordResetSchema>;

    const form = useForm<PasswordResetFormData>({
        resolver: zodResolver(passwordResetSchema),
        defaultValues: { newPassword: '', confirmPassword: '' },
    });

    async function onSubmit(data: PasswordResetFormData) {
        setError(null);

        const token = new URLSearchParams(window.location.search).get('token');
        if (!token) {
            setError(t`Missing verification token in the link`);
            return;
        }

        try {
            await resetPassword({ token, password: data.newPassword });
            setIsSuccess(true);
        } catch (err: unknown) {
            setError(translateAuthError(err as Error, i18n));
        }
    }

    if (isSuccess) {
        return (
            <AuthStatusCard
                tone="success"
                label={t`Password updated`}
                title={t`Password updated`}
                description={t`You can now sign in with the new password.`}
                action={{ label: t`Sign in →`, to: routes.LoginPageRoute.to }}
            />
        );
    }

    const submitting = form.formState.isSubmitting;

    return (
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="auth-form">
            {error && <div className="editorial-error" role="alert">{error}</div>}

            <Controller
                name="newPassword"
                control={form.control}
                render={({ field, fieldState }) => (
                    <div className="auth-field">
                        <label htmlFor="password">{t`New password`}</label>
                        <input
                            {...field}
                            id="password"
                            type="password"
                            placeholder={t`Min. 8 characters`}
                            autoComplete="new-password"
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

            <Controller
                name="confirmPassword"
                control={form.control}
                render={({ field, fieldState }) => (
                    <div className="auth-field">
                        <label htmlFor="confirm-password">{t`Repeat new password`}</label>
                        <input
                            {...field}
                            id="confirm-password"
                            type="password"
                            autoComplete="new-password"
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
                {submitting ? t`Updating…` : t`Update password →`}
            </button>
        </form>
    );
}
