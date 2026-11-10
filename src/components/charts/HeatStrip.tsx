import { Tooltip } from '../ui/Tooltip'
import { cn } from '../../lib/cn'
import { chartColor, type ChartColor } from './colors'

export interface HeatCell {
  label: string
  /** 0..1 intensity; null for days without data (weekend, no record). */
  value: number | null
  color?: ChartColor
}

interface HeatStripProps {
  cells: HeatCell[]
  height?: number
  'aria-label': string
  'data-testid'?: string
  className?: string
}

/** N small cells in a row; the fill strength is the intensity. Hover shows the day summary. */
export function HeatStrip({ cells, height = 16, className, 'aria-label': ariaLabel, 'data-testid': testId }: HeatStripProps) {
  return (
    <div role="img" aria-label={ariaLabel} data-testid={testId} className={cn('flex w-full gap-0.5', className)} style={{ height }}>
      {cells.map((c, i) => (
        <Tooltip key={i} content={c.label}>
          <div
            className="min-w-0 flex-1 rounded-[2px]"
            style={{
              backgroundColor: c.value === null ? 'rgb(var(--surface-2))' : chartColor(c.color ?? 'success', 0.2 + 0.8 * Math.min(1, Math.max(0, c.value))),
            }}
          />
        </Tooltip>
      ))}
    </div>
  )
}
