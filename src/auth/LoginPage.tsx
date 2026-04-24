import { Link as WaspRouterLink, routes } from 'wasp/client/router';
import { AuthPageLayout } from './AuthPageLayout';
import { CustomLoginForm } from './components/CustomLoginForm';

export default function Login() {
    return (
        <AuthPageLayout
            title="Zaloguj się"
            subtitle="Wróć do skrzynki opinii i odpowiedzi Twojego agenta."
            footer={
                <>
                    <div className="fd-auth-footer-row">
                        Nie masz jeszcze konta?{' '}
                        <WaspRouterLink to={routes.SignupPageRoute.to}>Załóż konto</WaspRouterLink>
                    </div>
                    <div className="fd-auth-footer-row">
                        <WaspRouterLink to={routes.RequestPasswordResetPageRoute.to}>Zapomniałeś hasła?</WaspRouterLink>
                    </div>
                </>
            }
        >
            <CustomLoginForm />
        </AuthPageLayout>
    );
}
