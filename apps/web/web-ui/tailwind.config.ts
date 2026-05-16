import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#5B5FC7",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
        },
        sidebar: {
          DEFAULT: "#5B5FC7",
          dark: "#4a4eb3",
          light: "#6e72d4",
        },
        surface: {
          DEFAULT: "#f8f9fc",
          card: "#ffffff",
          hover: "#f1f3f9",
          border: "#e5e7eb",
        },
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.25rem",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        "card-hover":
          "0 10px 25px rgba(0,0,0,0.08), 0 4px 10px rgba(0,0,0,0.04)",
        soft: "0 2px 8px rgba(0,0,0,0.06)",
        medium: "0 4px 16px rgba(0,0,0,0.08)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
export default config;
