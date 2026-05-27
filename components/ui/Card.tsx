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
  // Cursor pointer hanya kalau ada onClick — hover saja tidak menjadikan
  // card interaktif. Per rekomendasi UI/UX Pro Max "cursor-pointer:
  // add to all clickable elements, not just hover".
  const hoverCls = hover
    ? "transition-all duration-400 ease-glide hover:border-cyan/50 hover:shadow-glow hover:-translate-y-1"
    : "";
  const clickCls = onClick ? "cursor-pointer" : "";
  return (
    <div
      id={id}
      className={`${base} ${hoverCls} ${clickCls} ${className}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}
