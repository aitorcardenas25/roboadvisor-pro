import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:  ['var(--font-sans, var(--font-inter))', 'system-ui', 'sans-serif'],
        mono:  ['var(--font-plex-mono)', 'ui-monospace', 'monospace'],
        serif: ['var(--font-newsreader)', 'Georgia', 'serif'],
      },
      colors: {
        // ── Tokens semàntics (decisió de disseny 2026-11-18, direcció A+B) ──
        // Els valors viuen a app/globals.css com a variables CSS: per defecte
        // (portal, fosc) i dins .theme-admin (admin, clar). Així el mateix
        // component es veu bé a tots dos llocs.
        canvas:   'rgb(var(--c-canvas) / <alpha-value>)',
        surface:  'rgb(var(--c-surface) / <alpha-value>)',
        subtle: {
          DEFAULT: 'rgb(var(--c-subtle) / <alpha-value>)',
          strong:  'rgb(var(--c-subtle-strong) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--c-ink) / <alpha-value>)',
          soft:    'rgb(var(--c-ink-soft) / <alpha-value>)',
          muted:   'rgb(var(--c-ink-muted) / <alpha-value>)',
        },
        line: {
          DEFAULT: 'rgb(var(--c-line) / <alpha-value>)',
          strong:  'rgb(var(--c-line-strong) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--c-accent) / <alpha-value>)',
          hover:   'rgb(var(--c-accent-hover) / <alpha-value>)',
          soft:    'rgb(var(--c-accent-soft) / <alpha-value>)',
          ink:     'rgb(var(--c-accent-ink) / <alpha-value>)',
        },
        positive: 'rgb(var(--c-positive) / <alpha-value>)',
        negative: 'rgb(var(--c-negative) / <alpha-value>)',
        warning:  'rgb(var(--c-warning) / <alpha-value>)',
        info:     'rgb(var(--c-info) / <alpha-value>)',
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        gold: {
          400: '#f59e0b',
          500: '#c9a84c',
          600: '#b8860b',
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'card':       '0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.05)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07)',
      },
      animation: {
        'fade-in':    'fadeIn 0.3s ease-in-out',
        'slide-up':   'slideUp 0.4s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
