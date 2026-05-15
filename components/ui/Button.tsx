"use client";
import { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "ghost" | "secondary" | "outline" | "danger";
type Size = "sm" | "md" | "lg";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

const variants: Record<Variant, string> = {
  primary:
    "bg-cyan text-bgDeep hover:bg-cyanSoft shadow-glow hover:scale-[1.02] active:scale-[0.98]",
  secondary:
    "bg-gradient-to-r from-cyan to-purple text-bgDeep hover:opacity-90 shadow-glow",
  ghost:
    "border border-borderColor text-white hover:border-cyan hover:text-cyan bg-bgGlass backdrop-blur-md",
  outline:
    "border border-cyan/40 text-cyan hover:bg-cyan/10",
  danger:
    "bg-danger text-white hover:bg-danger/80",
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
    "rounded-md font-medium transition-all duration-200 inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-syne tracking-wide";
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
