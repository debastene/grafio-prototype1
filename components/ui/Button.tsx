"use client";
import { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "ghost" | "secondary" | "outline" | "danger";
type Size = "sm" | "md" | "lg";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

/**
 * Premium button system — focus-visible ring untuk accessibility,
 * micro-interaction (scale 0.97 on press), shadow refinement per variant.
 */
const variants: Record<Variant, string> = {
  primary:
    "bg-cyan text-bgDeep hover:bg-cyanSoft hover:shadow-glow-lg shadow-glow active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-cyan/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bgDeep",
  secondary:
    "bg-gradient-to-r from-cyan via-cyanSoft to-purple text-bgDeep hover:opacity-95 shadow-glow active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-cyan/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bgDeep",
  ghost:
    "border border-borderColor text-white hover:border-cyan/70 hover:text-cyan hover:bg-cyan/5 bg-bgGlass backdrop-blur-md active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-cyan/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bgDeep",
  outline:
    "border border-cyan/40 text-cyan hover:bg-cyan/10 hover:border-cyan active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-cyan/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bgDeep",
  danger:
    "bg-danger text-white hover:bg-danger/80 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-danger/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bgDeep",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3.5 text-base",
};

export default function Button({
  variant = "primary",
  size = "md",
  children,
  className = "",
  ...rest
}: Props) {
  const base =
    "rounded-md font-medium transition-all duration-200 ease-out inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100 font-syne tracking-wide outline-none whitespace-nowrap";
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
