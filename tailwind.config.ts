import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: { '2xl': '1440px' },
    },
    extend: {
      colors: {
        // ── Design tokens ─────────────────────────────────────────────
        // Map every shadcn semantic var to a hex from the brief
        bg:        { DEFAULT: '#060a12', subtle: '#0a0f1a', raised: '#111827' },
        surface:   { DEFAULT: '#0e1422', muted: '#161d2e', strong: '#1c2438' },
        border:    { DEFAULT: '#1f2937', strong: '#2a3447', subtle: '#141b29' },
        text:      { DEFAULT: '#e5e7eb', muted: '#9ca3af', subtle: '#6b7280', faint: '#4b5563' },
        accent:    { DEFAULT: '#7c6ef5', hover: '#9180ff', muted: 'rgba(124,110,245,.14)' },
        success:   { DEFAULT: '#10B981', hover: '#34d399', muted: 'rgba(16,185,129,.14)' },
        danger:    { DEFAULT: '#ef4444', hover: '#f87171', muted: 'rgba(239,68,68,.14)' },
        warn:      { DEFAULT: '#f59e0b', hover: '#fbbf24', muted: 'rgba(245,158,11,.14)' },
        info:      { DEFAULT: '#0ea5e9', hover: '#38bdf8', muted: 'rgba(14,165,233,.14)' },
        // shadcn aliases (used by ported primitives)
        background:  '#060a12',
        foreground:  '#e5e7eb',
        primary:     { DEFAULT: '#7c6ef5', foreground: '#ffffff' },
        secondary:   { DEFAULT: '#161d2e', foreground: '#e5e7eb' },
        destructive: { DEFAULT: '#ef4444', foreground: '#ffffff' },
        muted:       { DEFAULT: '#161d2e', foreground: '#9ca3af' },
        popover:     { DEFAULT: '#0e1422', foreground: '#e5e7eb' },
        card:        { DEFAULT: '#0e1422', foreground: '#e5e7eb' },
        input:       '#1f2937',
        ring:        '#7c6ef5',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        // tighter institutional scale
        '2xs': ['0.6875rem', { lineHeight: '0.875rem' }],
      },
      letterSpacing: {
        tightest: '-0.04em',
      },
      borderRadius: {
        lg: '12px',
        md: '8px',
        sm: '6px',
        xl: '16px',
      },
      boxShadow: {
        'card':      '0 1px 2px rgba(0,0,0,.4), 0 0 0 1px rgba(255,255,255,.02) inset',
        'card-lg':   '0 8px 32px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.04) inset',
        'glow':      '0 0 0 1px rgba(124,110,245,.4), 0 0 24px rgba(124,110,245,.25)',
        'glow-success': '0 0 0 1px rgba(16,185,129,.4), 0 0 24px rgba(16,185,129,.25)',
      },
      backgroundImage: {
        'grid':      'linear-gradient(rgba(255,255,255,.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.02) 1px, transparent 1px)',
        'noise':     'url("data:image/svg+xml;utf8,<svg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'><filter id=\'n\'><feTurbulence type=\'fractalNoise\' baseFrequency=\'.9\'/></filter><rect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'.4\'/></svg>")',
        'aurora':    'radial-gradient(circle at 20% 0%, rgba(124,110,245,.18) 0%, transparent 50%), radial-gradient(circle at 80% 100%, rgba(16,185,129,.12) 0%, transparent 50%)',
      },
      keyframes: {
        pulseGlow: {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(16,185,129,.4)' },
          '50%':     { boxShadow: '0 0 0 8px rgba(16,185,129,0)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s infinite',
        'slide-up':   'slideUp .4s cubic-bezier(.16,1,.3,1) both',
        'shimmer':    'shimmer 2s linear infinite',
      },
    },
  },
  plugins: [animate],
}
export default config
