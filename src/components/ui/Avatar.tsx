import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/cn'

const avatarVariants = cva(
  'inline-flex shrink-0 select-none items-center justify-center rounded-full font-medium',
  {
    variants: {
      size: {
        sm: 'size-6 text-xs',
        md: 'size-8 text-sm',
        lg: 'size-10 text-base',
        xl: 'size-16 text-xl',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}

/** Deterministic 1..8 palette slot from a name. Colors are CSS variables so dark mode swaps them. */
export function avatarHue(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return (h % 8) + 1
}

export interface AvatarProps extends VariantProps<typeof avatarVariants> {
  name: string
  className?: string
}

export function Avatar({ name, size, className }: AvatarProps) {
  const n = avatarHue(name)
  return (
    <span
      className={cn(avatarVariants({ size }), className)}
      style={{ backgroundColor: `rgb(var(--avatar-${n}-bg))`, color: `rgb(var(--avatar-${n}-fg))` }}
      aria-hidden
    >
      {initials(name)}
    </span>
  )
}
