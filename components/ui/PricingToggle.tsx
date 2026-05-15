"use client";

export default function PricingToggle({
  monthly,
  setMonthly,
}: {
  monthly: boolean;
  setMonthly: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-4 mb-10">
      <button
        onClick={() => setMonthly(true)}
        className={`text-sm font-medium transition-colors ${monthly ? "text-cyan" : "text-muted"}`}
      >
        Bulanan
      </button>
      <div className="w-px h-4 bg-borderColor" />
      <button
        onClick={() => setMonthly(false)}
        className={`text-sm font-medium transition-colors ${!monthly ? "text-cyan" : "text-muted"}`}
      >
        Tahunan{" "}
        <span className="text-xs text-muted">(hemat 20%)</span>
      </button>
    </div>
  );
}
