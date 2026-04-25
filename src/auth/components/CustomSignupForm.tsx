import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLingui } from '@lingui/react/macro';
import { signup } from 'wasp/client/auth';
import { routes } from 'wasp/client/router';
import { Button } from '../../components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '../../components/ui/field';
import { Input } from '../../components/ui/input';
import { translateAuthError } from '../utils/errorMessages';
import { AuthStatusCard } from './AuthStatusCard';

export function CustomSignupForm() {
    const { t } = useLingui();
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
            setError(translateAuthError(err as Error));
        }
    }

    if (needsConfirmation) {
        return (
            <AuthStatusCard
                icon="mail"
                title={t`Check your email`}
                description={t`We sent an activation link to your address. Click it to finish signing up.`}
                action={{ label: t`Back to sign in`, to: routes.LoginPageRoute.to }}
            />
        );
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
                                placeholder={t`Min. 8 characters`}
                                autoComplete="new-password"
                                aria-invalid={fieldState.invalid}
                                disabled={form.formState.isSubmitting}
                            />
                            {fieldState.error && <FieldError errors={[fieldState.error]} />}
                        </Field>
                    )}
                />

                <Controller
                    name="confirmPassword"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="confirm-password">{t`Repeat password`}</FieldLabel>
                            <Input
                                {...field}
                                id="confirm-password"
                                type="password"
                                autoComplete="new-password"
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
                    {form.formState.isSubmitting ? t`Creating account…` : t`Create account`}
                </Button>
            </FieldGroup>
        </form>
    );
}
