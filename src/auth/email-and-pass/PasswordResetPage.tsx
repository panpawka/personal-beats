import { Link as WaspRouterLink, routes } from 'wasp/client/router';
import { AuthPageLayout } from '../AuthPageLayout';
import { CustomPasswordResetForm } from '../components/CustomPasswordResetForm';

export function PasswordResetPage() {
    return (
        <AuthPageLayout
            title="Ustaw nowe hasło"
            subtitle="Wybierz hasło, którego używasz tylko tutaj — minimum 8 znaków."
            footer={
                <div className="fd-auth-footer-row">
                    Pamiętasz hasło?{' '}
                    <WaspRouterLink to={routes.LoginPageRoute.to}>Wróć do logowania</WaspRouterLink>
                </div>
            }
        >
            <CustomPasswordResetForm />
        </AuthPageLayout>
    );
}
