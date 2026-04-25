import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLingui } from '@lingui/react/macro';
import { signup } from 'wasp/client/auth';
import { routes } from 'wasp/client/router';
import { translateAuthError } from '../utils/errorMessages';
import { AuthStatusCard } from './AuthStatusCard';

export function CustomSignupForm() {
    const { t, i18n } = useLingui();
    const [error, setError] = useState<string | null>(null);
    const [needsConfirmation, setNeedsConfirmation] = useState(false);

    const signupSchema = z
        .object({
            email: z.string().email(t`Invalid email format`),
            password: z.string().min(8, t`Password must be at least 8 characters`),
            confirmPassword: z.string(),
        })
        .refine((data) => data.password === data.confirmPassword, {
            message: t`Passwords do not match`,
            path: ['confirmPassword'],
        });

    type SignupFormData = z.infer<typeof signupSchema>;

    const form = useForm<SignupFormData>({
        resolver: zodResolver(signupSchema),
        defaultValues: { email: '', password: '', confirmPassword: '' },
    });

    async function onSubmit(data: SignupFormData) {
        setError(null);
        try {
            // Wasp's EmailSignupData type includes all inferred UserEmailSignupFields
            // (username, isAdmin), but the server re-derives them from email. Cast to
            // bypass that constraint — see src/auth/userSignupFields.ts.
            await signup({ email: data.email, password: data.password } as any);
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
                description={t`We sent an activation link to your address. Click it to finish signing up.`}
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

            <Controller
                name="password"
                control={form.control}
                render={({ field, fieldState }) => (
                    <div className="auth-field">
                        <label htmlFor="password">{t`Password`}</label>
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
                        <label htmlFor="confirm-password">{t`Repeat password`}</label>
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

            <button
                type="submit"
                disabled={submitting}
                className="auth-submit signal"
            >
                {submitting ? t`Creating account…` : t`Create account →`}
            </button>
        </form>
    );
}
