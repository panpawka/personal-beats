import { Link as WaspRouterLink } from 'wasp/client/router';

type Tone = 'success' | 'mail' | 'error';

type Props = {
    /** Editorial tone — drives accent ink only. */
    tone?: Tone;
    /** Mono uppercase eyebrow above the headline. */
    label: string;
    title: string;
    description: string;
    action?: { label: string; to: string };
};

export function AuthStatusCard({ tone = 'success', label, title, description, action }: Props) {
    return (
        <div className="auth-status" data-tone={tone}>
            <span className="lbl">
                <span className="dot" aria-hidden />
                {label}
            </span>
            <h2>{title}</h2>
            <p>{description}</p>
            {action && (
                <div className="actions">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <WaspRouterLink
                        to={action.to as any}
                        className="auth-submit"
                        style={{ display: 'inline-flex', textDecoration: 'none' }}
                    >
                        {action.label}
                    </WaspRouterLink>
                </div>
            )}
        </div>
    );
}
