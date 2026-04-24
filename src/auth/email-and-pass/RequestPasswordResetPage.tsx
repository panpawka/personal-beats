import { Link as WaspRouterLink, routes } from 'wasp/client/router';
import { AuthPageLayout } from '../AuthPageLayout';
import { CustomRequestPasswordResetForm } from '../components/CustomRequestPasswordResetForm';

export function RequestPasswordResetPage() {
    return (
        <AuthPageLayout
            title="Przypomnij hasło"
            subtitle="Wyślemy Ci link do resetu — sprawdź skrzynkę za chwilę."
            footer={
                <div className="fd-auth-footer-row">
                    Przypomniałeś sobie?{' '}
                    <WaspRouterLink to={routes.LoginPageRoute.to}>Wróć do logowania</WaspRouterLink>
                </div>
            }
        >
            <CustomRequestPasswordResetForm />
        </AuthPageLayout>
    );
}
