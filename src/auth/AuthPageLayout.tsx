import { ReactNode } from 'react';
import { Link as WaspRouterLink, routes } from 'wasp/client/router';
import { useLingui } from '@lingui/react/macro';

type Props = {
    children: ReactNode;
    title?: string;
    subtitle?: string;
    footer?: ReactNode;
};

export function AuthPageLayout({ children, title, subtitle, footer }: Props) {
    const { t } = useLingui();
    return (
        <div className="fd-auth-root">
            <div className="fd-auth-aurora" aria-hidden="true" />
            <div className="fd-auth-shell">
                <WaspRouterLink to={routes.LandingRoute.to} className="fd-auth-brand" aria-label={t`feednode`}>
                    <img src="/landing/favicon_color_light.svg" alt="" />
                    <span>feednode</span>
                </WaspRouterLink>

                <div className="fd-auth-card">
                    {(title || subtitle) && (
                        <header className="fd-auth-head">
                            {title && <h1>{title}</h1>}
                            {subtitle && <p>{subtitle}</p>}
                        </header>
                    )}
                    <div className="fd-auth-body">{children}</div>
                </div>

                {footer && <div className="fd-auth-footer">{footer}</div>}

                <div className="fd-auth-legal">
                    <span>© 2026 Lemonode sp. z o.o.</span>
                    <span className="sep">·</span>
                    <a href="https://feednode.pl" target="_blank" rel="noreferrer">
                        feednode.pl
                    </a>
                </div>
            </div>
        </div>
    );
}
