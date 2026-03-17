/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        space: ["var(--font-space)"],
        inter: ["var(--font-inter)"],
      },
      colors: {
        'accent-cyan': '#00f0ff',
        'accent-purple': '#8b5cf6',
        'accent-pink': '#f050f0',
        'accent-blue': '#3b82f6',
        'bg-dark': '#050510',
      }
    },
  },
  plugins: [],
};
