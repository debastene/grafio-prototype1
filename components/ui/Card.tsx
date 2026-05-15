import { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  glass?: boolean;
  hover?: boolean;
  onClick?: () => void;
  id?: string;
};

export default function Card({
  children,
  className = "",
  glass = false,
  hover = false,
  onClick,
  id,
}: Props) {
  const base = glass
    ? "glass rounded-xl p-6 relative"
    : "bg-bgSurface border border-borderColor rounded-xl p-6 relative";
  const hoverCls = hover
    ? "transition-all duration-300 hover:border-cyan/50 hover:shadow-glow hover:-translate-y-1 cursor-pointer"
    : "";
  return (
    <div
      id={id}
      className={`${base} ${hoverCls} ${className}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      {children}
    </div>
  );
}
