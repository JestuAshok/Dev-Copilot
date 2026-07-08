/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: "#1A1A1A",
          panel: "#212121",
          card: "#2A2A2A",
          border: "#333333",
          text: "#E8E8E8",
          muted: "#888888"
        },
        brand: {
          coral: "#3B82F6",
          mint: "#4ECDC4",
          sky: "#45B7D1",
          lavender: "#A29BFE",
          amber: "#F9CA24",
          pink: "#8B5CF6"
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
        mono: ['Fira Code', 'JetBrains Mono', 'monospace']
      },
    },
  },
  plugins: [],
}
