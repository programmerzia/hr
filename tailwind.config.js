const c = (name) => `rgb(var(--${name}) / <alpha-value>)`

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: c('bg'),
        surface: c('surface'),
        'surface-2': c('surface-2'),
        border: c('border'),
        'border-strong': c('border-strong'),
        fg: c('fg'),
        'fg-muted': c('fg-muted'),
        'fg-subtle': c('fg-subtle'),
        accent: c('accent'),
        'accent-fg': c('accent-fg'),
        'accent-soft': c('accent-soft'),
        success: c('success'),
        'success-soft': c('success-soft'),
        warning: c('warning'),
        'warning-soft': c('warning-soft'),
        danger: c('danger'),
        'danger-soft': c('danger-soft'),
        info: c('info'),
        'info-soft': c('info-soft'),
        ring: c('ring'),
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        xs: ['12px', '16px'],
        sm: ['13px', '20px'],
        base: ['14px', '20px'],
        lg: ['15px', '22px'],
        xl: ['20px', '28px'],
      },
      borderRadius: {
        DEFAULT: '4px',
        md: '6px',
        lg: '8px',
      },
      boxShadow: {
        float: '0 4px 16px rgb(0 0 0 / 0.12), 0 0 0 1px rgb(var(--border) / 1)',
      },
      maxWidth: { content: '1280px' },
    },
  },
  plugins: [],
}
