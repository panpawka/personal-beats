import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "default" | "primary" | "accent" | "ghost";
type Size = "default" | "icon" | "lg";

interface EditorialButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children?: ReactNode;
}

export function EditorialButton({
  variant = "default",
  size = "default",
  className = "",
  children,
  type = "button",
  ...rest
}: EditorialButtonProps) {
  const classes = ["pb-btn"];
  if (variant === "primary") classes.push("pb-btn-primary");
  if (variant === "accent") classes.push("pb-btn-accent");
  if (variant === "ghost") classes.push("pb-btn-ghost");
  if (size === "icon") classes.push("pb-btn-icon");
  if (size === "lg") classes.push("pb-btn-lg");
  if (className) classes.push(className);

  return (
    <button type={type} className={classes.join(" ")} {...rest}>
      {children}
    </button>
  );
}
