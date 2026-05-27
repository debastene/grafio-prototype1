"use client";

/**
 * Pricing period toggle — pill switcher dengan sliding indicator.
 * Tetap simple: dua opsi, satu state boolean. Props tidak berubah dari
 * versi sebelumnya supaya pricing/page.tsx tidak perlu rewiring.
 */
export default function PricingToggle({
  monthly,
  setMonthly,
}: {
  monthly: boolean;
  setMonthly: (v: boolean) => void;
}) {
  return (
    <div className="flex justify-center mb-12">
      <div className="relative inline-flex items-center bg-bgSurface/60 backdrop-blur-sm border border-borderColor rounded-full p-1 shadow-soft">
        {/* Sliding pill */}
        <span
          className={`absolute top-1 bottom-1 w-[calc(50%-0.25rem)] rounded-full bg-gradient-to-r from-cyan/25 to-violet/25 border border-cyan/40 shadow-glow transition-transform duration-400 ease-glide ${
            monthly ? "translate-x-0" : "translate-x-full"
          }`}
        />
        <button
          type="button"
          onClick={() => setMonthly(true)}
          className={`relative z-10 px-5 md:px-7 py-2.5 text-sm font-medium font-syne tracking-wide transition-colors duration-250 rounded-full ${
            monthly ? "text-white" : "text-muted hover:text-white"
          }`}
        >
          Bulanan
        </button>
        <button
          type="button"
          onClick={() => setMonthly(false)}
          className={`relative z-10 px-5 md:px-7 py-2.5 text-sm font-medium font-syne tracking-wide transition-colors duration-250 rounded-full inline-flex items-center gap-2 ${
            !monthly ? "text-white" : "text-muted hover:text-white"
          }`}
        >
          Tahunan
          <span
            className={`text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded-full transition-colors duration-250 ${
              !monthly
                ? "bg-mint/20 text-mint border border-mint/40"
                : "bg-bgElevated text-muted border border-borderColor"
            }`}
          >
            hemat 20%
          </span>
        </button>
      </div>
    </div>
  );
}
