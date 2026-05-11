/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}', './api/**/*.{ts,tsx}'],
  theme: {
    extend: {
      boxShadow: { soft: '0 18px 50px rgba(117,231,255,.16)' }
    }
  },
  plugins: []
};
