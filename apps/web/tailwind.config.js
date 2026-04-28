/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem"
      },
      colors: {
        play: {
          DEFAULT: "#f5f7fa",
          card: "rgb(var(--play-card))",
          muted: "#64748b"
        }
      },
      boxShadow: {
        play: "0 1px 3px rgb(15 23 42 / 0.06), 0 8px 24px rgb(79 70 229 / 0.06)"
      }
    }
  },
  plugins: []
};
