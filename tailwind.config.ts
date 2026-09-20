import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./themes/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          base: "rgb(var(--sf-base) / <alpha-value>)",
          primary: "rgb(var(--sf-primary) / <alpha-value>)",
          raised: "rgb(var(--sf-raised) / <alpha-value>)",
          border: "rgb(var(--sf-border) / <alpha-value>)",
          "border-secondary": "rgb(var(--sf-border-secondary) / <alpha-value>)",
        },
        content: {
          primary: "rgb(var(--tx-primary) / <alpha-value>)",
          secondary: "rgb(var(--tx-secondary) / <alpha-value>)",
          muted: "rgb(var(--tx-muted) / <alpha-value>)",
          faint: "rgb(var(--tx-faint) / <alpha-value>)",
        },
        accent: {
          300: "rgb(var(--ac-300) / <alpha-value>)",
          400: "rgb(var(--ac-400) / <alpha-value>)",
          500: "rgb(var(--ac-500) / <alpha-value>)",
          600: "rgb(var(--ac-600) / <alpha-value>)",
        },
        /* Keep brand as an alias of accent for migration compatibility */
        brand: {
          300: "rgb(var(--ac-300) / <alpha-value>)",
          400: "rgb(var(--ac-400) / <alpha-value>)",
          500: "rgb(var(--ac-500) / <alpha-value>)",
          600: "rgb(var(--ac-600) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-ui)",
        ],
        mono: [
          "var(--font-mono)",
        ],
      },
      borderRadius: {
        theme: "var(--border-radius)",
      },
      boxShadow: {
        panel: "var(--panel-shadow)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-down": {
          from: { opacity: "0", transform: "translateY(-8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "tutorial-pulse": {
          "0%, 100%": {
            boxShadow:
              "inset 0 0 0 1.5px rgb(var(--tut-glow) / 0.6), 0 0 12px 2px rgb(var(--tut-glow) / 0.15)",
          },
          "50%": {
            boxShadow:
              "inset 0 0 0 1.5px rgb(var(--tut-glow) / 0.75), 0 0 16px 3px rgb(var(--tut-glow) / 0.2)",
          },
        },
      },
      animation: {
        "fade-in": "fade-in 150ms ease-out",
        "slide-up": "slide-up 200ms ease-out",
        "slide-down": "slide-down 200ms ease-out",
        "scale-in": "scale-in 150ms ease-out",
        "tutorial-pulse": "tutorial-pulse 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
