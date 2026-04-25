import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLingui } from '@lingui/react/macro';
import { requestPasswordReset } from 'wasp/client/auth';
import { routes } from 'wasp/client/router';
import { Button } from '../../components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '../../components/ui/field';
import { Input } from '../../components/ui/input';
import { translateAuthError } from '../utils/errorMessages';
import { AuthStatusCard } from './AuthStatusCard';

export function CustomRequestPasswordResetForm() {
    const { t } = useLingui();
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
            setError(translateAuthError(err as Error));
        }
    }

    if (needsConfirmation) {
        return (
            <AuthStatusCard
                icon="mail"
                title={t`Check your email`}
                description={t`If an account with that address exists, we sent a password reset link.`}
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

                <Button
                    type="submit"
                    size="lg"
                    disabled={form.formState.isSubmitting}
                    className="w-full"
                >
                    {form.formState.isSubmitting ? t`Sending…` : t`Send reset link`}
                </Button>
            </FieldGroup>
        </form>
    );
}
