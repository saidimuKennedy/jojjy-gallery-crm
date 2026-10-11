/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ['"Inter"', "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      borderRadius: {
        card: "1rem", // 16px — cards, modals, tables
        field: "0.75rem", // 12px — inputs, selects, textareas
        "4xl": "2rem",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(28 27 25 / 0.04), 0 1px 3px 0 rgb(28 27 25 / 0.06)",
        pop: "0 10px 30px -12px rgb(28 27 25 / 0.25)",
      },
      colors: {
        ink: {
          50: "#f6f6f5",
          100: "#e8e7e4",
          200: "#d1d0cb",
          300: "#b0aea6",
          400: "#8a877d",
          500: "#6f6c62",
          600: "#58554d",
          700: "#484640",
          800: "#3d3b37",
          900: "#353430",
          950: "#1c1b19",
        },
        // Single accent for primary actions (blue-600 family). Tokens exist so
        // pages never hardcode hex/raw palette classes.
        accent: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
        },
        // Semantic aliases — prefer these over raw `ink-*` in new work.
        surface: "#ffffff",
        border: "#e8e7e4",
        muted: "#6f6c62",
      },
    },
  },
  plugins: [],
};
