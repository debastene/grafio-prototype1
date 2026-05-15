import { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  glass?: boolean;
  hover?: boolean;
  onClick?: () => void;
  id?: string;
};

/**
 * Card primitive — dua mode: glass (translucent + backdrop blur) atau solid
 * (bg-bgSurface). Hover memberikan subtle lift + cyan border glow.
 *
 * shadow-soft di default biar card terasa "ngambang" tipis di atas grid bg,
 * bukan flat. Tetap subtle (8% alpha).
 */
export default function Card({
  children,
  className = "",
  glass = false,
  hover = false,
  onClick,
  id,
}: Props) {
  const base = glass
    ? "glass rounded-xl p-6 relative shadow-soft"
    : "bg-bgSurface border border-borderColor rounded-xl p-6 relative shadow-soft";
  const hoverCls = hover
    ? "transition-all duration-300 ease-out hover:border-cyan/50 hover:shadow-glow hover:-translate-y-1 cursor-pointer"
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
