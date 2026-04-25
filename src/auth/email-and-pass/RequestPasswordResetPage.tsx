import { Link as WaspRouterLink, routes } from 'wasp/client/router';
import { Trans, useLingui } from '@lingui/react/macro';
import { AuthPageLayout } from '../AuthPageLayout';
import { CustomRequestPasswordResetForm } from '../components/CustomRequestPasswordResetForm';

export function RequestPasswordResetPage() {
    const { t } = useLingui();
    return (
        <AuthPageLayout
            eyebrow={t`Forgot your password?`}
            title={
                <Trans>
                    We'll send a <em>fresh</em> link.
                </Trans>
            }
            subtitle={t`Drop your email and we'll mail a reset link — check your inbox in a moment.`}
            footer={
                <span>
                    <Trans>
                        Remembered it?{' '}
                        <WaspRouterLink to={routes.LoginPageRoute.to}>Back to sign in</WaspRouterLink>
                    </Trans>
                </span>
            }
        >
            <CustomRequestPasswordResetForm />
        </AuthPageLayout>
    );
}
