import { Link as WaspRouterLink } from 'wasp/client/router';
import { Button } from '../../components/ui/button';

type IconKind = 'success' | 'mail' | 'error';

const ICON_PATHS: Record<IconKind, string> = {
    success: 'M5 13l4 4L19 7',
    mail: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    error: 'M12 9v2m0 4h.01M4.93 19h14.14c1.54 0 2.5-1.67 1.73-3L13.73 4.99c-.77-1.33-2.69-1.33-3.46 0L3.2 16c-.77 1.33.19 3 1.73 3z',
};

const ICON_BG: Record<IconKind, string> = {
    success: 'bg-green-100 text-green-600',
    mail: 'bg-primary/10 text-primary',
    error: 'bg-destructive/10 text-destructive',
};

type Props = {
    icon: IconKind;
    title: string;
    description: string;
    action?: { label: string; to: string };
};

export function AuthStatusCard({ icon, title, description, action }: Props) {
    return (
        <div className="flex flex-col items-center gap-4 text-center">
            <div className={`rounded-full p-3 ${ICON_BG[icon]}`}>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d={ICON_PATHS[icon]}
                    />
                </svg>
            </div>
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground text-balance">{description}</p>
            {action && (
                <Button asChild className="mt-2 w-full">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <WaspRouterLink to={action.to as any}>{action.label}</WaspRouterLink>
                </Button>
            )}
        </div>
    );
}
