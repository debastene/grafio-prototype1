import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bgDeep: "#05081A",
        bgSurface: "#0A1230",
        bgElevated: "#0F1A3F",
        bgGlass: "rgba(15,26,63,0.55)",
        navy: "#0B1A48",
        royal: "#1E3A8A",
        borderColor: "rgba(255,255,255,0.08)",
        borderGlow: "rgba(0,212,255,0.35)",
        cyan: "#00D4FF",
        cyanSoft: "#7DE3FF",
        purple: "#7B5EA7",
        mint: "#00FFB3",
        silver: "#E2E8F0",
        muted: "#7A88AC",
        danger: "#FF4D6D",
        warning: "#FFB547",
        success: "#10B981",
      },
      fontFamily: {
        syne: ["var(--font-syne)", "sans-serif"],
        dm: ["var(--font-dm)", "sans-serif"],
      },
      backgroundImage: {
        "grad-hero":
          "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(30,58,138,0.55), transparent 60%), radial-gradient(ellipse 60% 40% at 80% 30%, rgba(0,212,255,0.15), transparent 60%), radial-gradient(ellipse 50% 30% at 20% 80%, rgba(123,94,167,0.18), transparent 60%)",
        "grad-card":
          "linear-gradient(135deg, rgba(15,26,63,0.6) 0%, rgba(11,26,72,0.4) 100%)",
        "grad-cyan":
          "linear-gradient(135deg, #00D4FF 0%, #7DE3FF 50%, #1E3A8A 100%)",
        noise:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.05 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(0,212,255,0.25), 0 8px 40px -8px rgba(0,212,255,0.35)",
        soft: "0 8px 30px -12px rgba(0,0,0,0.6)",
      },
      keyframes: {
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        spinSlow: {
          to: { transform: "rotate(360deg)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        pulseGlow: {
          "0%,100%": { boxShadow: "0 0 0 0 rgba(0,212,255,0.4)" },
          "50%": { boxShadow: "0 0 0 12px rgba(0,212,255,0)" },
        },
        fadeUp: {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        spinSlow: "spinSlow 40s linear infinite",
        shimmer: "shimmer 2.5s linear infinite",
        pulseGlow: "pulseGlow 2.5s ease-out infinite",
        fadeUp: "fadeUp 0.6s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
