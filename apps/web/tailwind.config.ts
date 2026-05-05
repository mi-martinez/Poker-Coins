import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        felt: {
          DEFAULT: "#0d6b3f",
          dark: "#084d2c",
          light: "#138a52",
        },
        chip: {
          white: "#f5f5f5",
          red: "#d33232",
          blue: "#2d6cdf",
          green: "#1f8a3f",
          black: "#1a1a1a",
          purple: "#7c3aed",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Impact", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
