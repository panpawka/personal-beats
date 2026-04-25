import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLingui } from '@lingui/react/macro';
import { login } from 'wasp/client/auth';
import { routes } from 'wasp/client/router';
import { Button } from '../../components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '../../components/ui/field';
import { Input } from '../../components/ui/input';
import { translateAuthError } from '../utils/errorMessages';

export function CustomLoginForm() {
    const { t } = useLingui();
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
            setError(translateAuthError(err as Error));
        }
    }

    return (
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <FieldGroup>
                {error && (
                    <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                        {error}
                    </div>
                )}

                <Controller
                    name="email"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="email">{t`Email`}</FieldLabel>
                            <Input
                                {...field}
                                id="email"
                                type="email"
                                placeholder={t`you@company.com`}
                                autoComplete="email"
                                aria-invalid={fieldState.invalid}
                                disabled={form.formState.isSubmitting}
                            />
                            {fieldState.error && <FieldError errors={[fieldState.error]} />}
                        </Field>
                    )}
                />

                <Controller
                    name="password"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="password">{t`Password`}</FieldLabel>
                            <Input
                                {...field}
                                id="password"
                                type="password"
                                autoComplete="current-password"
                                aria-invalid={fieldState.invalid}
                                disabled={form.formState.isSubmitting}
                            />
                            {fieldState.error && <FieldError errors={[fieldState.error]} />}
                        </Field>
                    )}
                />

                <Button
                    type="submit"
                    size="lg"
                    disabled={form.formState.isSubmitting}
                    className="w-full"
                >
                    {form.formState.isSubmitting ? t`Signing in…` : t`Sign in`}
                </Button>
            </FieldGroup>
        </form>
    );
}
