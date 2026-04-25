import { Link as WaspRouterLink, routes } from 'wasp/client/router';
import { Trans, useLingui } from '@lingui/react/macro';
import { AuthPageLayout } from './AuthPageLayout';
import { CustomSignupForm } from './components/CustomSignupForm';

export function Signup() {
    const { t } = useLingui();
    return (
        <AuthPageLayout
            title={t`Create an account`}
            subtitle={t`14 days free. No card. No commitment.`}
            footer={
                <div className="fd-auth-footer-row">
                    <Trans>
                        Already have an account?{' '}
                        <WaspRouterLink to={routes.LoginPageRoute.to}>Sign in</WaspRouterLink>
                    </Trans>
                </div>
            }
        >
            <CustomSignupForm />
        </AuthPageLayout>
    );
}
