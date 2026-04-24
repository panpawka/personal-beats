import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { requestPasswordReset } from 'wasp/client/auth';
import { routes } from 'wasp/client/router';
import { Button } from '../../components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '../../components/ui/field';
import { Input } from '../../components/ui/input';
import { translateAuthError } from '../utils/errorMessages';
import { AuthStatusCard } from './AuthStatusCard';

const resetRequestSchema = z.object({
    email: z.string().email('Nieprawidłowy format e-mail'),
});

type ResetRequestFormData = z.infer<typeof resetRequestSchema>;

export function CustomRequestPasswordResetForm() {
    const [error, setError] = useState<string | null>(null);
    const [needsConfirmation, setNeedsConfirmation] = useState(false);

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
                title="Sprawdź skrzynkę e-mail"
                description="Jeżeli konto z tym adresem istnieje, wysłaliśmy link do zresetowania hasła."
                action={{ label: 'Wróć do logowania', to: routes.LoginPageRoute.to }}
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
                            <FieldLabel htmlFor="email">E-mail</FieldLabel>
                            <Input
                                {...field}
                                id="email"
                                type="email"
                                placeholder="ty@firma.pl"
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
                    {form.formState.isSubmitting ? 'Wysyłanie…' : 'Wyślij link resetujący'}
                </Button>
            </FieldGroup>
        </form>
    );
}
