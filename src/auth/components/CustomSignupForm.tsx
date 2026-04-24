import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { signup } from 'wasp/client/auth';
import { routes } from 'wasp/client/router';
import { Button } from '../../components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '../../components/ui/field';
import { Input } from '../../components/ui/input';
import { translateAuthError } from '../utils/errorMessages';
import { AuthStatusCard } from './AuthStatusCard';

const signupSchema = z
    .object({
        email: z.string().email('Nieprawidłowy format e-mail'),
        password: z.string().min(8, 'Hasło musi mieć co najmniej 8 znaków'),
        confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: 'Hasła nie są identyczne',
        path: ['confirmPassword'],
    });

type SignupFormData = z.infer<typeof signupSchema>;

export function CustomSignupForm() {
    const [error, setError] = useState<string | null>(null);
    const [needsConfirmation, setNeedsConfirmation] = useState(false);

    const form = useForm<SignupFormData>({
        resolver: zodResolver(signupSchema),
        defaultValues: { email: '', password: '', confirmPassword: '' },
    });

    async function onSubmit(data: SignupFormData) {
        setError(null);
        try {
            // Wasp's EmailSignupData type includes all inferred UserEmailSignupFields
            // (username, isAdmin), but the server re-derives them from email. Cast to
            // bypass that constraint \u2014 see src/auth/userSignupFields.ts.
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
                title="Sprawdź skrzynkę e-mail"
                description="Wysłaliśmy link aktywacyjny na podany adres. Kliknij go, aby dokończyć rejestrację."
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

                <Controller
                    name="password"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="password">Hasło</FieldLabel>
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
                            <FieldLabel htmlFor="confirm-password">Powtórz hasło</FieldLabel>
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
                    {form.formState.isSubmitting ? 'Tworzenie konta…' : 'Załóż konto'}
                </Button>
            </FieldGroup>
        </form>
    );
}
