"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "accent" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground border-[color-mix(in_oklab,var(--primary),#000_22%)] shadow-[2px_3px_0_0_rgba(60,45,30,0.25)]",
  secondary:
    "bg-secondary text-secondary-foreground border-[color-mix(in_oklab,var(--secondary),#000_22%)] shadow-[2px_3px_0_0_rgba(60,45,30,0.25)]",
  accent:
    "bg-accent text-accent-foreground border-[color-mix(in_oklab,var(--accent),#000_18%)] shadow-[2px_3px_0_0_rgba(60,45,30,0.25)]",
  outline:
    "bg-card text-foreground border-border shadow-[2px_3px_0_0_rgba(60,45,30,0.14)] hover:border-primary",
  ghost: "bg-transparent text-foreground border-transparent hover:bg-muted",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 gap-1.5 px-3 text-sm rounded-lg",
  md: "h-11 gap-2 px-4 text-base rounded-xl",
  lg: "h-12 gap-2 px-6 text-lg rounded-2xl",
};

export interface GameButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const GameButton = React.forwardRef<HTMLButtonElement, GameButtonProps>(
  (
    { className, variant = "primary", size = "md", type = "button", ...props },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex select-none items-center justify-center whitespace-nowrap border-2 font-bold transition-all",
          "active:translate-x-[2px] active:translate-y-[3px] active:shadow-none",
          "disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none",
          "hover:brightness-[1.04]",
          VARIANTS[variant],
          SIZES[size],
          className
        )}
        {...props}
      />
    );
  }
);
GameButton.displayName = "GameButton";
