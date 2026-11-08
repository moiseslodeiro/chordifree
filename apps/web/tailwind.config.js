/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        page: 'rgb(var(--color-page) / <alpha-value>)',
        panel: 'rgb(var(--color-panel) / <alpha-value>)',
        'panel-2': 'rgb(var(--color-panel-2) / <alpha-value>)',
        line: 'rgb(var(--color-line) / <alpha-value>)',
        'line-strong': 'rgb(var(--color-line-strong) / <alpha-value>)',
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        ink2: 'rgb(var(--color-ink-2) / <alpha-value>)',
        ink3: 'rgb(var(--color-ink-3) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        'accent-strong': 'rgb(var(--color-accent-strong) / <alpha-value>)',
        'on-accent': 'rgb(var(--color-on-accent) / <alpha-value>)',
        positive: 'rgb(var(--color-positive) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
      },
      fontFamily: {
        display: 'var(--font-display)',
        sans: 'var(--font-sans)',
        mono: 'var(--font-mono)',
      },
      borderRadius: {
        DEFAULT: '8px',
        sm: '6px',
        md: '8px',
        lg: '10px',
        xl: '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
      boxShadow: {
        DEFAULT: '0 1px 2px rgb(10 13 18 / 0.05)',
        sm: '0 1px 2px rgb(10 13 18 / 0.05)',
        md: '0 8px 24px -18px rgb(10 13 18 / 0.35)',
        lg: '0 1px 2px rgb(10 13 18 / 0.05), 0 10px 28px -22px rgb(10 13 18 / 0.35)',
        xl: '0 1px 2px rgb(10 13 18 / 0.05), 0 10px 28px -22px rgb(10 13 18 / 0.35)',
        '2xl': '0 18px 48px -24px rgb(10 13 18 / 0.4)',
      },
    },
  },
  plugins: [],
};
