import { useEffect, useRef, useState } from 'react';
import { verifyEmail } from 'wasp/client/auth';
import { routes } from 'wasp/client/router';
import { Button } from '../../components/ui/button';
import { translateAuthError } from '../utils/errorMessages';
import { AuthStatusCard } from './AuthStatusCard';

export function CustomEmailVerificationForm() {
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const didAutoVerify = useRef(false);

    async function runVerification(token: string) {
        setError(null);
        setIsLoading(true);
        try {
            await verifyEmail({ token });
            setIsSuccess(true);
        } catch (err: unknown) {
            setError(translateAuthError(err as Error));
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        if (didAutoVerify.current) return;
        const token = new URLSearchParams(window.location.search).get('token');
        if (!token) return;
        didAutoVerify.current = true;
        runVerification(token);
    }, []);

    async function handleClick() {
        const token = new URLSearchParams(window.location.search).get('token');
        if (!token) {
            setError('Brak tokenu weryfikacyjnego w linku');
            return;
        }
        await runVerification(token);
    }

    if (isSuccess) {
        return (
            <AuthStatusCard
                icon="success"
                title="E-mail został zweryfikowany"
                description="Twoje konto jest aktywne. Możesz się teraz zalogować."
                action={{ label: 'Zaloguj się', to: routes.LoginPageRoute.to }}
            />
        );
    }

    return (
        <div className="flex flex-col items-center gap-4 text-center">
            <h2 className="text-xl font-semibold">Weryfikacja e-maila</h2>
            <p className="text-sm text-muted-foreground text-balance">
                {isLoading ? 'Weryfikujemy Twój adres e-mail…' : 'Kliknij przycisk poniżej, aby dokończyć weryfikację.'}
            </p>

            {error && (
                <div className="w-full rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                    {error}
                </div>
            )}

            <Button
                onClick={handleClick}
                disabled={isLoading}
                size="lg"
                className="w-full"
            >
                {isLoading ? 'Weryfikowanie…' : 'Zweryfikuj e-mail'}
            </Button>
        </div>
    );
}
