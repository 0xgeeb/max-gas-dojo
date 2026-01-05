/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        slideDown: {
          'from': { top: '50px', opacity: '0' },
          'to': { top: '100px', opacity: '1' }
        }
      },
      animation: {
        slideDown: 'slideDown 0.3s ease'
      }
    },
  },
  plugins: [],
}
