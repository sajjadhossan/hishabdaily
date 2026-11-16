import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        ink: "rgb(var(--text) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        brand: {
          DEFAULT: "rgb(var(--brand) / <alpha-value>)",
          soft: "rgb(var(--brand-soft) / <alpha-value>)",
          50: "#eefcf6",
          100: "#d5f8e7",
          200: "#adf0d3",
          300: "#76e3ba",
          400: "#3ecd9c",
          500: "#19b283",
          600: "#0c906a",
          700: "#0b7357",
          800: "#0c5b47",
          900: "#0b4b3c",
        },
        danger: "#e5484d",
        warn: "#f5a524",
      },
      fontFamily: {
        sans: ["Hind Siliguri", "Inter", "system-ui", "sans-serif"],
        display: ["Hind Siliguri", "Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,38,30,.04), 0 8px 24px -12px rgba(16,38,30,.18)",
        pop: "0 20px 60px -12px rgba(8,25,19,.35)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "sheet-in": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        pop: {
          "0%": { transform: "scale(.92)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-up": "fade-up .35s ease both",
        "sheet-in": "sheet-in .3s cubic-bezier(.22,1,.36,1) both",
        pop: "pop .2s ease both",
      },
    },
  },
  plugins: [],
};

export default config;
