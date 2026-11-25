import { formatMoney } from '../../lib/format'
import { cn } from '../../lib/cn'
import type { Currency } from '../../types'

/** Right-aligned mono amount. Use `Td` without `numeric` when wrapping this to avoid double styling. */
export function MoneyCell({
  amount,
  currency = 'BDT',
  className,
}: {
  amount: number
  currency?: Currency
  className?: string
}) {
  return (
    <span className={cn('block text-right num ', amount < 0 && 'text-danger', className)}>
      {formatMoney(amount, currency)}
    </span>
  )
}
