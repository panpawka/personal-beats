import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { resetPassword } from 'wasp/client/auth';
import { routes } from 'wasp/client/router';
import { Button } from '../../components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '../../components/ui/field';
import { Input } from '../../components/ui/input';
import { translateAuthError } from '../utils/errorMessages';
import { AuthStatusCard } from './AuthStatusCard';

const passwordResetSchema = z
    .object({
        newPassword: z.string().min(8, 'Hasło musi mieć co najmniej 8 znaków'),
        confirmPassword: z.string(),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        message: 'Hasła nie są identyczne',
        path: ['confirmPassword'],
    });

type PasswordResetFormData = z.infer<typeof passwordResetSchema>;

export function CustomPasswordResetForm() {
    const [error, setError] = useState<string | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);

    const form = useForm<PasswordResetFormData>({
        resolver: zodResolver(passwordResetSchema),
        defaultValues: { newPassword: '', confirmPassword: '' },
    });

    async function onSubmit(data: PasswordResetFormData) {
        setError(null);

        const token = new URLSearchParams(window.location.search).get('token');
        if (!token) {
            setError('Brak tokenu weryfikacyjnego w linku');
            return;
        }

        try {
            await resetPassword({ token, password: data.newPassword });
            setIsSuccess(true);
        } catch (err: unknown) {
            setError(translateAuthError(err as Error));
        }
    }

    if (isSuccess) {
        return (
            <AuthStatusCard
                icon="success"
                title="Hasło zostało zmienione"
                description="Możesz teraz zalogować się nowym hasłem."
                action={{ label: 'Zaloguj się', to: routes.LoginPageRoute.to }}
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
                    name="newPassword"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="password">Nowe hasło</FieldLabel>
                            <Input
                                {...field}
                                id="password"
                                type="password"
                                placeholder="Min. 8 znaków"
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
                            <FieldLabel htmlFor="confirm-password">Powtórz nowe hasło</FieldLabel>
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
                    {form.formState.isSubmitting ? 'Zmienianie…' : 'Zmień hasło'}
                </Button>
            </FieldGroup>
        </form>
    );
}
