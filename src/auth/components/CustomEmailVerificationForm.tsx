import { useEffect, useRef, useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { verifyEmail } from 'wasp/client/auth';
import { routes } from 'wasp/client/router';
import { Button } from '../../components/ui/button';
import { translateAuthError } from '../utils/errorMessages';
import { AuthStatusCard } from './AuthStatusCard';

export function CustomEmailVerificationForm() {
    const { t } = useLingui();
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
            setError(t`Missing verification token in the link`);
            return;
        }
        await runVerification(token);
    }

    if (isSuccess) {
        return (
            <AuthStatusCard
                icon="success"
                title={t`Email verified`}
                description={t`Your account is active. You can sign in now.`}
                action={{ label: t`Sign in`, to: routes.LoginPageRoute.to }}
            />
        );
    }

    return (
        <div className="flex flex-col items-center gap-4 text-center">
            <h2 className="text-xl font-semibold">
                <Trans>Email verification</Trans>
            </h2>
            <p className="text-sm text-muted-foreground text-balance">
                {isLoading ? t`Verifying your email address…` : t`Click the button below to finish verification.`}
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
                {isLoading ? t`Verifying…` : t`Verify email`}
            </Button>
        </div>
    );
}
