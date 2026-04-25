import { Link as WaspRouterLink, routes } from 'wasp/client/router';
import { Trans, useLingui } from '@lingui/react/macro';
import { AuthPageLayout } from './AuthPageLayout';
import { CustomLoginForm } from './components/CustomLoginForm';

export default function Login() {
    const { t } = useLingui();
    return (
        <AuthPageLayout
            eyebrow={t`Already a reader → log in`}
            title={
                <Trans>
                    Welcome back, <em>reader</em>.
                </Trans>
            }
            subtitle={t`Back to your inbox of opinions and your agent's replies.`}
            footer={
                <>
                    <span>
                        <Trans>
                            Don't have an account yet?{' '}
                            <WaspRouterLink to={routes.SignupPageRoute.to}>Create one</WaspRouterLink>
                        </Trans>
                    </span>
                    <span>
                        <WaspRouterLink to={routes.RequestPasswordResetPageRoute.to}>
                            <Trans>Forgot your password?</Trans>
                        </WaspRouterLink>
                    </span>
                </>
            }
        >
            <CustomLoginForm />
        </AuthPageLayout>
    );
}
