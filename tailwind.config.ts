import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy:    { DEFAULT: '#0C1F3F', mid: '#1A3664' },
        blue:    { DEFAULT: '#2455A4' },
        amber:   { DEFAULT: '#C97E0A', lt: '#E8950E' },
        paper:   { DEFAULT: '#F4F3EF', dk: '#EBEAE4' },
        outcome: {
          approved:    '#166534',
          'approved-bg': '#DCFCE7',
          denied:      '#991B1B',
          'denied-bg': '#FEE2E2',
          tabled:      '#78350F',
          'tabled-bg': '#FEF3C7',
          discussed:   '#1E3A8A',
          'discussed-bg': '#DBEAFE',
        },
        committee: {
          council:  '#1A3664',
          planning: '#145241',
          bza:      '#6B2D00',
          other:    '#374151',
        },
      },
      fontFamily: {
        serif: ['Playfair Display', 'Georgia', 'serif'],
        sans:  ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono:  ['IBM Plex Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
