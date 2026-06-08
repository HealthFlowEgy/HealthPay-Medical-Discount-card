import type { Config } from "tailwindcss";

// "MediBook" partner brand — distinct from HealthPay (indigo/slate) so it's
// visually clear this is a separate third-party platform.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#4f46e5",
          50: "#eef2ff",
          100: "#e0e7ff",
          500: "#4f46e5",
          600: "#4338ca",
          700: "#3730a3",
        },
        ink: { DEFAULT: "#0f172a", 600: "#475569", 400: "#94a3b8" },
      },
    },
  },
  plugins: [],
};

export default config;
