import type { Config } from 'tailwindcss'
import tailwindcss from '@tailwindcss/vite'

/**
 * Fablr — Cinematic Darkroom Tailwind Config
 *
 * Warm charcoal palette with amber/gold cinema accents.
 * All values also defined as CSS custom properties in globals.css.
 */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        /* ── Core backgrounds (warm charcoal) ── */
        'bg-base':       '#08080a',
        'bg-primary':    '#0c0c0e',
        'bg-secondary':  '#111114',
        'bg-tertiary':   '#161619',
        'bg-elevated':   '#1a1a1e',
        'bg-hover':      '#1f1f24',
        'bg-active':     '#26262c',

        /* ── Borders (warm-tinted) ── */
        'border-subtle':  '#1e1e23',
        'border-default': '#2a2a31',
        'border-strong':  '#38383f',
        'border-active':  '#4a4a52',

        /* ── Text ── */
        'text-primary':   '#f0eee8',
        'text-secondary': '#9a9690',
        'text-tertiary':  '#6b6760',
        'text-disabled':  '#4a4742',

        /* ── Accent — Amber/Gold cinema ── */
        'accent-primary':       '#c8956c',
        'accent-primary-hover': '#d4a574',
        'accent-primary-dim':   '#8a6848',
        'accent-gold':          '#d4a574',
        'accent-amber':         '#c49660',
        'accent-warm':          '#b8856a',

        /* ── Functional accents ── */
        'accent-secondary': '#6b8cce',
        'accent-success':   '#5a9e6f',
        'accent-warning':   '#c49660',
        'accent-danger':    '#c75050',

        /* ── Timeline track colors ── */
        'timeline-video':    '#8b7ec8',
        'timeline-audio':    '#5a9e9e',
        'timeline-subtitle': '#c49660',

        /* ── shadcn/ui required tokens ── */
        'foreground':           '#f0eee8',
        'muted':                '#161619',
        'muted-foreground':     '#9a9690',
        'popover':              '#1a1a1e',
        'popover-foreground':   '#f0eee8',
        'accent':               '#1f1f24',
        'accent-foreground':    '#f0eee8',
        'primary':              '#c8956c',
        'primary-foreground':   '#ffffff',
        'secondary':            '#161619',
        'secondary-foreground': '#f0eee8',
        'destructive':          '#c75050',
        'destructive-foreground': '#ffffff',
        'border':               '#2a2a31',
        'input':                '#161619',
        'ring':                 '#c8956c',
        'ring-offset':          '#0c0c0e',
      },
      fontFamily: {
        display: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
        sans:    ['Inter', 'Geist Variable', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'SF Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config
