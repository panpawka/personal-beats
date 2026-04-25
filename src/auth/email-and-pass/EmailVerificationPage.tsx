import { Link as WaspRouterLink, routes } from 'wasp/client/router';
import { Trans, useLingui } from '@lingui/react/macro';
import { AuthPageLayout } from '../AuthPageLayout';
import { CustomEmailVerificationForm } from '../components/CustomEmailVerificationForm';

export function EmailVerificationPage() {
    const { t } = useLingui();
    return (
        <AuthPageLayout
            eyebrow={t`Email verification`}
            title={
                <Trans>
                    Confirming <em>you</em>.
                </Trans>
            }
            subtitle={t`We're checking your address so we know where to deliver the paper.`}
            footer={
                <span>
                    <Trans>
                        All set?{' '}
                        <WaspRouterLink to={routes.LoginPageRoute.to}>Sign in</WaspRouterLink>
                    </Trans>
                </span>
            }
        >
            <CustomEmailVerificationForm />
        </AuthPageLayout>
    );
}
