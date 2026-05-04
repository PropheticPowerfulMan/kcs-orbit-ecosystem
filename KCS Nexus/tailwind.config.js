/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        night: "#1a202c",
        ivory: "#f8f8f6",
        royal: "#2b50e6",
        gold: "#b58b45"
      },
      boxShadow: {
        soft: "0 14px 35px -15px rgba(26, 32, 44, 0.25)",
      }
    },
  },
  plugins: [],
}
