import { cn } from '../../lib/cn'

/** Rounded accent square with a V path. Colors come from tokens so it follows the theme. */
export function Logomark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={cn('shrink-0', className)} aria-hidden>
      <rect width="24" height="24" rx="6" fill="rgb(var(--accent))" />
      <path
        d="M7 8.5 12 16.5 17 8.5"
        fill="none"
        stroke="rgb(var(--accent-fg))"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
