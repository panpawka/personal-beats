import type { ReactNode } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { Masthead } from "../layout/Masthead";

type Props = {
    children: ReactNode;
    eyebrow?: string;
    title: ReactNode;
    subtitle?: string;
    footer?: ReactNode;
};

export function AuthPageLayout({ children, eyebrow, title, subtitle, footer }: Props) {
    const { t } = useLingui();
    const kicker = eyebrow ?? t`A personal newsroom, yours alone`;
    return (
        <div className="auth-shell">
            <Masthead hideLogin />

            <main className="auth-stage">
                <section className="auth-col">
                    <span className="auth-kicker">{kicker}</span>
                    <h1 className="auth-h1">{title}</h1>
                    {subtitle ? <p className="auth-sub">{subtitle}</p> : null}
                    {children}
                    {footer ? <div className="auth-foot">{footer}</div> : null}
                </section>
            </main>

            <footer className="auth-legal">
                <span>
                    <Trans>© MMXXVI · Lemonode sp. z o.o.</Trans>
                </span>
                <span>
                    <Trans>A personal newsroom</Trans>
                </span>
            </footer>
        </div>
    );
}
