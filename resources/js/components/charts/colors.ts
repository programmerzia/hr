/** Chart colors are theme tokens. Categorical series use chart-1..8; status keeps its semantic color. */
export type ChartColor =
  | 'chart-1'
  | 'chart-2'
  | 'chart-3'
  | 'chart-4'
  | 'chart-5'
  | 'chart-6'
  | 'chart-7'
  | 'chart-8'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'accent'
  | 'muted'

const varName: Record<ChartColor, string> = {
  'chart-1': '--chart-1',
  'chart-2': '--chart-2',
  'chart-3': '--chart-3',
  'chart-4': '--chart-4',
  'chart-5': '--chart-5',
  'chart-6': '--chart-6',
  'chart-7': '--chart-7',
  'chart-8': '--chart-8',
  success: '--success',
  warning: '--warning',
  danger: '--danger',
  info: '--info',
  accent: '--accent',
  muted: '--fg-subtle',
}

export function chartColor(c: ChartColor, alpha = 1): string {
  return alpha === 1 ? `rgb(var(${varName[c]}))` : `rgb(var(${varName[c]}) / ${alpha})`
}

/** chart-1..8 by position, wrapping. */
export function seriesColor(i: number): ChartColor {
  return `chart-${(i % 8) + 1}` as ChartColor
}
