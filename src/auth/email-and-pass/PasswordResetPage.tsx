import { Link as WaspRouterLink, routes } from 'wasp/client/router';
import { Trans, useLingui } from '@lingui/react/macro';
import { AuthPageLayout } from '../AuthPageLayout';
import { CustomPasswordResetForm } from '../components/CustomPasswordResetForm';

export function PasswordResetPage() {
    const { t } = useLingui();
    return (
        <AuthPageLayout
            eyebrow={t`Reset password`}
            title={
                <Trans>
                    Pick a <em>new</em> password.
                </Trans>
            }
            subtitle={t`Choose a password you only use here — minimum 8 characters.`}
            footer={
                <span>
                    <Trans>
                        Remembered it?{' '}
                        <WaspRouterLink to={routes.LoginPageRoute.to}>Back to sign in</WaspRouterLink>
                    </Trans>
                </span>
            }
        >
            <CustomPasswordResetForm />
        </AuthPageLayout>
    );
}
