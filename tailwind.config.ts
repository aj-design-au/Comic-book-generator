import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Prevent blue/violet gradients by explicitly not defining them or using them
      },
      fontFamily: {
        comic: ['"Comic Sans MS"', '"Chalkboard SE"', 'sans-serif'],
      }
    },
  },
  plugins: [],
};
export default config;

