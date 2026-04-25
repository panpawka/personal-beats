import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLingui } from '@lingui/react/macro';
import { login } from 'wasp/client/auth';
import { routes } from 'wasp/client/router';
import { translateAuthError } from '../utils/errorMessages';

export function CustomLoginForm() {
    const { t, i18n } = useLingui();
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    const loginSchema = z.object({
        email: z.string().email(t`Invalid email format`),
        password: z.string().min(1, t`Password is required`),
    });

    type LoginFormData = z.infer<typeof loginSchema>;

    const form = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
        defaultValues: { email: '', password: '' },
    });

    async function onSubmit(data: LoginFormData) {
        setError(null);
        try {
            await login({ email: data.email, password: data.password });
            navigate(routes.DashboardRoute.to);
        } catch (err: unknown) {
            setError(translateAuthError(err as Error, i18n));
        }
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
                            autoComplete="current-password"
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
                {submitting ? t`Signing in…` : t`Sign in →`}
            </button>
        </form>
    );
}
