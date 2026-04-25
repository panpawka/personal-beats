import { useEffect, useRef, useState } from 'react';
import { useLingui } from '@lingui/react/macro';
import { verifyEmail } from 'wasp/client/auth';
import { routes } from 'wasp/client/router';
import { translateAuthError } from '../utils/errorMessages';
import { AuthStatusCard } from './AuthStatusCard';

export function CustomEmailVerificationForm() {
    const { t, i18n } = useLingui();
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
            setError(translateAuthError(err as Error, i18n));
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
                tone="success"
                label={t`Email verified`}
                title={t`Your account is active`}
                description={t`Your account is active. You can sign in now.`}
                action={{ label: t`Sign in →`, to: routes.LoginPageRoute.to }}
            />
        );
    }

    return (
        <div className="auth-form" style={{ borderTop: 0 }}>
            {error && <div className="editorial-error" role="alert">{error}</div>}
            <p className="auth-sub" style={{ margin: 0 }}>
                {isLoading
                    ? t`Verifying your email address…`
                    : t`Click the button below to finish verification.`}
            </p>
            <button
                type="button"
                onClick={handleClick}
                disabled={isLoading}
                className="auth-submit signal"
            >
                {isLoading ? t`Verifying…` : t`Verify email →`}
            </button>
        </div>
    );
}
