import { Tooltip } from '../ui/Tooltip'
import { cn } from '../../lib/cn'
import { chartColor, type ChartColor } from './colors'

export interface StackSegment {
  label: string
  value: number
  color: ChartColor
  /** Text shown next to the label in the legend; defaults to the value. */
  display?: string
}

interface StackedBarProps {
  segments: StackSegment[]
  height?: number
  /** Hide zero segments from the legend (the bar never draws them). Default true. */
  hideZero?: boolean
  'aria-label': string
  'data-testid'?: string
  className?: string
  legendClassName?: string
}

/** Horizontal composition bar with a legend. Segments are separated by 2px gaps. */
export function StackedBar({
  segments,
  height = 12,
  hideZero = true,
  className,
  legendClassName,
  'aria-label': ariaLabel,
  'data-testid': testId,
}: StackedBarProps) {
  const shown = segments.filter((s) => s.value > 0)
  const total = shown.reduce((a, s) => a + s.value, 0)
  const legend = hideZero ? shown : segments
  return (
    <div className={cn('w-full', className)} data-testid={testId}>
      <div
        role="img"
        aria-label={ariaLabel}
        className="flex w-full gap-0.5 overflow-hidden rounded-full bg-surface-2"
        style={{ height }}
      >
        {shown.map((s) => (
          <Tooltip key={s.label} content={`${s.label}: ${s.display ?? s.value}`}>
            <div
              className="grow-x h-full first:rounded-l-full last:rounded-r-full"
              style={{ width: `${(s.value / total) * 100}%`, backgroundColor: chartColor(s.color) }}
            />
          </Tooltip>
        ))}
      </div>
      <ul className={cn('mt-3 flex flex-wrap gap-x-5 gap-y-1.5', legendClassName)}>
        {legend.map((s) => (
          <li key={s.label} className="flex items-center gap-1.5 text-sm">
            <span className="size-2 rounded-full" style={{ backgroundColor: chartColor(s.color) }} aria-hidden />
            <span className="text-fg-muted">{s.label}</span>
            <span className="font-mono font-medium tabular-nums">{s.display ?? s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
