import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './store/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      boxShadow: {
        glow: '0 0 0 1px rgba(63, 63, 70, 0.6), 0 20px 60px rgba(0, 0, 0, 0.45)',
      },
      colors: {
        panel: {
          950: '#09090b',
          900: '#111113',
          800: '#18181b',
        },
      },
    },
  },
  plugins: [],
};

export default config;
