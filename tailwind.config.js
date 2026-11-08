/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#111B2B', 900: '#0B1320', 800: '#111B2B', 700: '#1A273B', 600: '#243449', 500: '#324560', 400: '#4A5F7D' },
        gold: { DEFAULT: '#B69A52', 300: '#D4BE83', 400: '#C6AB63', 500: '#B69A52', 600: '#98803F' },
        olive: { DEFAULT: '#657C55', 400: '#7F9770', 500: '#657C55', 600: '#4F6342' },
      },
      fontFamily: {
        sans: ['Cairo', 'Tajawal', 'system-ui', 'sans-serif'],
        display: ['Cairo', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        gold: '0 0 0 1px rgba(182,154,82,.35), 0 8px 30px -12px rgba(182,154,82,.35)',
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: { 'fade-up': 'fade-up .45s ease-out both' },
    },
  },
  plugins: [],
};
