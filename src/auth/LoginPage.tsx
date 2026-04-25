import { Link as WaspRouterLink, routes } from 'wasp/client/router';
import { Trans, useLingui } from '@lingui/react/macro';
import { AuthPageLayout } from './AuthPageLayout';
import { CustomLoginForm } from './components/CustomLoginForm';

export default function Login() {
    const { t } = useLingui();
    return (
        <AuthPageLayout
            title={t`Sign in`}
            subtitle={t`Back to your inbox of opinions and your agent's replies.`}
            footer={
                <>
                    <div className="fd-auth-footer-row">
                        <Trans>
                            Don't have an account yet?{' '}
                            <WaspRouterLink to={routes.SignupPageRoute.to}>Create one</WaspRouterLink>
                        </Trans>
                    </div>
                    <div className="fd-auth-footer-row">
                        <WaspRouterLink to={routes.RequestPasswordResetPageRoute.to}>
                            <Trans>Forgot your password?</Trans>
                        </WaspRouterLink>
                    </div>
                </>
            }
        >
            <CustomLoginForm />
        </AuthPageLayout>
    );
}
