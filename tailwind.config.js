/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
        display: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
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
      },
    },
  },
  plugins: [],
};
