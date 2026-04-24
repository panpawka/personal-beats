'use client';

import { useState } from 'react';
import { CheckIcon, CopyIcon } from 'lucide-react';

import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { IconType } from 'react-icons/lib';

interface ActionButtonProps {
    label?: string;
    onClick?: () => void | Promise<void>;
    tooltip?: string;
    successTooltip?: string;
    normalIcon?: IconType;
    successIcon?: IconType;
    className?: string;
    disabled?: boolean;
}

export default function ActionButton({
    label,
    onClick,
    tooltip = 'Click to copy',
    successTooltip = 'Copied!',
    normalIcon,
    successIcon,
    className,
    disabled = false,
}: ActionButtonProps) {
    const [actionState, setActionState] = useState<'idle' | 'success'>('idle');

    const handleAction = async () => {
        if (disabled) return;

        try {
            if (onClick) {
                await onClick();
            } else if (label) {
                await navigator.clipboard.writeText(label);
            }

            setActionState('success');
            setTimeout(() => setActionState('idle'), 1500);
        } catch (err) {
            console.error('Action failed: ', err);
        }
    };

    const isSuccess = actionState === 'success';
    const displayTooltip = isSuccess ? successTooltip : tooltip;
    const SuccessIcon: IconType = (successIcon as IconType) || CheckIcon;
    const NormalIcon: IconType = (normalIcon as IconType) || CopyIcon;

    return (
        <TooltipProvider delayDuration={0}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn('disabled:opacity-100', className)}
                        onClick={handleAction}
                        aria-label={displayTooltip}
                        disabled={isSuccess}
                    >
                        <div className={cn('transition-all', isSuccess ? 'scale-100 opacity-100' : 'scale-0 opacity-0')}>
                            <SuccessIcon className="stroke-emerald-500" size={16} aria-hidden="true" />
                        </div>
                        <div className={cn('absolute transition-all', isSuccess ? 'scale-0 opacity-0' : 'scale-100 opacity-100')}>
                            <NormalIcon size={16} aria-hidden="true" />
                        </div>
                    </Button>
                </TooltipTrigger>
                <TooltipContent className="px-2 py-1 text-xs">{displayTooltip}</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
