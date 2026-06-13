import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#fe2c55",
          dark: "#c11138",
        },
      },
    },
  },
  plugins: [],
};
export default config;
