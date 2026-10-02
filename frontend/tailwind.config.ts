import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        // Soft, diffuse card shadow — the "floating card on light gray"
        // look this genre of admin dashboard uses instead of hard borders.
        soft: "0 1px 2px 0 rgb(15 23 42 / 0.03), 0 8px 24px -4px rgb(15 23 42 / 0.06)",
        softer: "0 1px 2px 0 rgb(15 23 42 / 0.02), 0 4px 16px -4px rgb(15 23 42 / 0.04)",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.375rem",
      },
    },
  },
  plugins: [],
};

export default config;
