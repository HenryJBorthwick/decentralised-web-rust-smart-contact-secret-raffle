/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#673ab7',  // old MUI primary
        secondary: '#ff4081',  // old MUI secondary
      },
    },
  },
  plugins: [],
}; 