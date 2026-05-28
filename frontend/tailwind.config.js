/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        nexus: {
          bg: "#000000",
          surface: "#0a0a0c",
          panel: "rgba(255,255,255,0.025)",
          panel2: "rgba(255,255,255,0.04)",
          border: "rgba(255,255,255,0.07)",
          borderStrong: "rgba(255,255,255,0.14)",
          text: "#f5f5f7",
          muted: "rgba(245,245,247,0.55)",
          subtle: "rgba(245,245,247,0.35)",
          accent: "#f5f5f7",
          accent2: "#a8a8ac",
          chrome: "#d8d8da",
          error: "#ef4444",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "pulse-fast": "pulse 0.9s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow": "spin 8s linear infinite",
      },
      backdropBlur: { xs: "2px" },
      letterSpacing: {
        tightest: "-0.04em",
      },
      boxShadow: {
        "glass": "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 0 0 1px rgba(255,255,255,0.06)",
        "glow-soft": "0 0 40px rgba(255,255,255,0.04)",
      },
    },
  },
  plugins: [],
};
