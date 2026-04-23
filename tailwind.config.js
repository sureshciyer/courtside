/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Outfit", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        "disruption-glow":
          "0 0 0 1.5px rgba(245,158,11,0.85), 0 0 14px rgba(245,158,11,0.45)",
        "focus-glow":
          "0 0 0 2px rgba(52,211,153,0.9), 0 0 16px rgba(52,211,153,0.35)",
      },
      keyframes: {
        "pulse-arm": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(52,211,153,0.5)" },
          "50%": { boxShadow: "0 0 0 6px rgba(52,211,153,0)" },
        },
      },
      animation: {
        "pulse-arm": "pulse-arm 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
