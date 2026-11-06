import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef8ff",
          100: "#d9efff",
          200: "#bce2fe",
          300: "#8eccfd",
          400: "#59adfb",
          500: "#328cf6",
          600: "#1b6ee9",
          700: "#1457d5",
          800: "#1647ad",
          900: "#173d88",
          950: "#122653",
        },
      },
    },
  },
  plugins: [],
};
export default config;

