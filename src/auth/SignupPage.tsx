import { Link as WaspRouterLink, routes } from 'wasp/client/router';
import { AuthPageLayout } from './AuthPageLayout';
import { CustomSignupForm } from './components/CustomSignupForm';

export function Signup() {
    return (
        <AuthPageLayout
            title="Załóż konto"
            subtitle="14 dni bezpłatnie. Bez karty. Bez zobowiązań."
            footer={
                <div className="fd-auth-footer-row">
                    Masz już konto?{' '}
                    <WaspRouterLink to={routes.LoginPageRoute.to}>Zaloguj się</WaspRouterLink>
                </div>
            }
        >
            <CustomSignupForm />
        </AuthPageLayout>
    );
}
