import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/cn'

const avatarVariants = cva(
  'inline-flex shrink-0 select-none items-center justify-center rounded-full bg-accent-soft font-medium text-accent',
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

export interface AvatarProps extends VariantProps<typeof avatarVariants> {
  name: string
  className?: string
}

export function Avatar({ name, size, className }: AvatarProps) {
  return (
    <span className={cn(avatarVariants({ size }), className)} aria-hidden>
      {initials(name)}
    </span>
  )
}
