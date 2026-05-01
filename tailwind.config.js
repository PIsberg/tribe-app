/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        fire: {
          deep: "#051a05",
          ember: "#ff4500",
          glow: "#ff8c00",
          ash: "#2a2a2a",
          char: "#4a4a4a",
        },
      },
      fontFamily: {
        mono: ["'Courier New'", "Courier", "monospace"],
        sans: ["'Inter'", "system-ui", "sans-serif"],
      },
      animation: {
        flicker: "flicker 3s ease-in-out infinite",
        "pulse-fire": "pulse-fire 2s ease-in-out infinite",
        "fade-char": "fade-char 5min linear forwards",
      },
      keyframes: {
        flicker: {
          "0%, 100%": { opacity: "0.9" },
          "25%": { opacity: "0.7" },
          "50%": { opacity: "1" },
          "75%": { opacity: "0.8" },
        },
        "pulse-fire": {
          "0%, 100%": { boxShadow: "0 0 8px #ff4500, 0 0 16px #ff450044" },
          "50%": { boxShadow: "0 0 16px #ff4500, 0 0 32px #ff450088" },
        },
      },
    },
  },
  plugins: [],
};
