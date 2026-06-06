import type { Config } from "tailwindcss";

// HealthPay brand palette: navy, teal, gold.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#0B1F3F",
          50: "#eef2f8",
          100: "#d4def0",
          700: "#152d52",
          800: "#0f2444",
          900: "#0B1F3F",
        },
        teal: {
          DEFAULT: "#14B8A6",
          50: "#effcf9",
          100: "#c9f3ec",
          500: "#14B8A6",
          600: "#0f9488",
        },
        gold: {
          DEFAULT: "#D4A24E",
          400: "#e0b772",
          500: "#D4A24E",
        },
      },
    },
  },
  plugins: [],
};

export default config;
