import { Link as WaspRouterLink, routes } from 'wasp/client/router';
import { AuthPageLayout } from '../AuthPageLayout';
import { CustomEmailVerificationForm } from '../components/CustomEmailVerificationForm';

export function EmailVerificationPage() {
    return (
        <AuthPageLayout
            title="Weryfikacja e-maila"
            subtitle="Potwierdzamy Twój adres, aby zabezpieczyć konto."
            footer={
                <div className="fd-auth-footer-row">
                    Wszystko gotowe?{' '}
                    <WaspRouterLink to={routes.LoginPageRoute.to}>Zaloguj się</WaspRouterLink>
                </div>
            }
        >
            <CustomEmailVerificationForm />
        </AuthPageLayout>
    );
}
