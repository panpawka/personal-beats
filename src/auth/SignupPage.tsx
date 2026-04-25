import { Link as WaspRouterLink, routes } from 'wasp/client/router';
import { Trans, useLingui } from '@lingui/react/macro';
import { AuthPageLayout } from './AuthPageLayout';
import { CustomSignupForm } from './components/CustomSignupForm';

export function Signup() {
    const { t } = useLingui();
    return (
        <AuthPageLayout
            eyebrow={t`Found a personal newsroom`}
            title={
                <Trans>
                    Start <em>your</em> paper.
                </Trans>
            }
            subtitle={t`14 days free. No card. No commitment.`}
            footer={
                <span>
                    <Trans>
                        Already have an account?{' '}
                        <WaspRouterLink to={routes.LoginPageRoute.to}>Sign in</WaspRouterLink>
                    </Trans>
                </span>
            }
        >
            <CustomSignupForm />
        </AuthPageLayout>
    );
}
