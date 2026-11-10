import { Tooltip } from '../ui/Tooltip'
import { cn } from '../../lib/cn'
import { chartColor, seriesColor, type ChartColor } from './colors'

export interface BarDatum {
  label: string
  /** One value per series. */
  values: number[]
  /** Highlight this bar (for example today). */
  active?: boolean
}

interface BarsProps {
  data: BarDatum[]
  /** Series names, used in tooltips and the legend when more than one. */
  series?: { name: string; color?: ChartColor }[]
  /** Horizontal reference line, in the same unit as values. */
  target?: { value: number; label: string }
  height?: number
  format?: (v: number) => string
  'aria-label': string
  'data-testid'?: string
  className?: string
}

/** Vertical bars with a baseline, optional target line and hover tooltips. At most 14 groups. */
export function Bars({
  data,
  series = [{ name: 'Value' }],
  target,
  height = 120,
  format = (v) => String(v),
  className,
  'aria-label': ariaLabel,
  'data-testid': testId,
}: BarsProps) {
  const max = Math.max(1, target?.value ?? 0, ...data.flatMap((d) => d.values)) * 1.08
  const colors = series.map((s, i) => s.color ?? seriesColor(i))
  const multi = series.length > 1
  return (
    <div className={cn('w-full', className)} data-testid={testId} role="img" aria-label={ariaLabel}>
      <div className="relative" style={{ height }}>
        {target && (
          <div
            className="absolute inset-x-0 z-10 border-t border-dashed border-fg-subtle"
            style={{ bottom: `${(target.value / max) * 100}%` }}
          >
            <span className="absolute -top-4 right-0 rounded bg-surface px-1 text-xs text-fg-subtle">{target.label}</span>
          </div>
        )}
        <div className="absolute inset-0 flex items-end gap-2 border-b border-border-strong px-1">
          {data.map((d) => (
            <Tooltip
              key={d.label}
              content={
                <span className="block">
                  <span className="block font-medium">{d.label}</span>
                  {d.values.map((v, i) => (
                    <span key={i} className="block tabular-nums">
                      {multi ? `${series[i]?.name}: ` : ''}
                      {format(v)}
                    </span>
                  ))}
                </span>
              }
            >
              <div className="group flex h-full min-w-0 flex-1 cursor-default items-end justify-center gap-0.5">
                {d.values.map((v, i) => (
                  <div
                    key={i}
                    className={cn(
                      'grow-y w-full max-w-8 rounded-t-sm transition-opacity duration-150',
                      multi ? 'max-w-4' : '',
                      d.active === false && 'opacity-50',
                    )}
                    style={{
                      height: `${(v / max) * 100}%`,
                      minHeight: v > 0 ? 2 : 0,
                      backgroundColor: chartColor(colors[i] ?? 'chart-1', d.active ? 1 : 0.85),
                    }}
                  />
                ))}
              </div>
            </Tooltip>
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex gap-2 px-1">
        {data.map((d) => (
          <span
            key={d.label}
            className={cn('min-w-0 flex-1 truncate text-center text-xs text-fg-subtle', d.active && 'font-medium text-fg')}
          >
            {d.label}
          </span>
        ))}
      </div>
      {multi && (
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-fg-muted">
          {series.map((s, i) => (
            <li key={s.name} className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm" style={{ backgroundColor: chartColor(colors[i] ?? 'chart-1') }} aria-hidden />
              {s.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
