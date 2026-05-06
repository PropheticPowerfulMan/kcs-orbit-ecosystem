/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        abyss: '#070B14',
        cobalt: '#1B3C73',
        cyan: '#14B8A6',
        ember: '#F97316',
        'kcs-blue': '#0EA5D8',
        'github-bg': '#0D1117',
        'github-canvas': '#010409',
        'github-panel': 'rgba(22, 27, 34, 0.72)',
        'github-border': 'rgba(139, 148, 158, 0.24)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
        metric: ['var(--font-metric)', 'monospace'],
      },
      boxShadow: {
        neon: '0 0 0 1px rgba(20,184,166,0.25), 0 12px 35px rgba(20,184,166,0.18)',
        glass: '0 18px 48px rgba(1,4,9,0.34), 0 0 0 1px rgba(88,166,255,0.08)',
      },
    },
  },
  plugins: [],
};
