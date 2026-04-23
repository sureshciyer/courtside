/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        display: ["Outfit", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      colors: {
        court: { DEFAULT: "#1B5E20", light: "#E8F5E9", ink: "#0b3b11" },
        role: {
          "opening-bg": "#e3f2fd", "opening-fg": "#0d47a1",
          "disruption-bg": "#fff3e0", "disruption-fg": "#e65100",
          "finish-bg": "#ffebee", "finish-fg": "#b71c1c",
          "neutral-bg": "#f5f5f5", "neutral-fg": "#78909c",
        },
      },
    },
  },
  plugins: [],
};
