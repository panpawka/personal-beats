import type { ButtonHTMLAttributes, ReactNode } from "react";

interface SuggestChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export function SuggestChip({ children, type = "button", className = "", ...rest }: SuggestChipProps) {
  return (
    <button type={type} className={`suggest-chip ${className}`.trim()} {...rest}>
      {children}
    </button>
  );
}
