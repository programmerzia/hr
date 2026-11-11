import { router } from '@inertiajs/react'
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, parseISO, startOfMonth, startOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '../../components/shared/PageHeader'
import { Avatar, Button, IconButton, NativeSelect } from '../../components/ui'
import { cn } from '../../lib/cn'
import { useShared } from '../../inertia/props'
import type { LeaveRequest, LeaveType } from '../../types'
import { isWeekend, shortTypeName, todayIso, toIso, type LeavePerson } from './helpers'

const MAX_CHIPS = 3
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface CalendarProps {
  /** YYYY-MM */
  month: string
  wide: boolean
  events: LeaveRequest[]
  people: LeavePerson[]
  teams: { id: string; name: string }[]
  leave_types: LeaveType[]
}

export default function CalendarPage() {
  const { month, wide, events, people, teams, leave_types } = useShared<CalendarProps>()
  const [teamId, setTeamId] = useState('all')
  const cursor = startOfMonth(parseISO(`${month}-01`))
  const goTo = (d: Date) =>
    router.get(route('leave.calendar'), { month: format(d, 'yyyy-MM') }, { preserveScroll: true, preserveState: true, only: ['month', 'events'] })

  const scoped = people.filter((e) => !wide || teamId === 'all' || e.team_id === teamId)
  const scopeIds = new Set(scoped.map((e) => e.id))
  const personName = (id: string) => people.find((p) => p.id === id)?.name ?? ''
  const approvedOn = (date: string) => events.filter((r) => r.starts_on <= date && r.ends_on >= date)

  const days = eachDayOfInterval({ start: startOfWeek(cursor), end: endOfWeek(endOfMonth(cursor)) })
  const today = todayIso()
  const typeName = (id: string) => leave_types.find((t) => t.id === id)?.name ?? ''

  return (
    <div className="mx-auto max-w-content">
      <PageHeader
        title="Leave calendar"
        description={wide ? 'Approved leave across the company' : 'Approved leave in your team'}
        actions={
          <>
            {wide && (
              <NativeSelect aria-label="Team" value={teamId} onChange={(e) => setTeamId(e.target.value)} className="w-48">
                <option value="all">All teams</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </NativeSelect>
            )}
            <Button onClick={() => goTo(startOfMonth(new Date()))}>Today</Button>
            <IconButton label="Previous month" onClick={() => goTo(addMonths(cursor, -1))}>
              <ChevronLeft size={16} />
            </IconButton>
            <IconButton label="Next month" onClick={() => goTo(addMonths(cursor, 1))}>
              <ChevronRight size={16} />
            </IconButton>
          </>
        }
      />
      <h2 className="mb-2 text-lg font-semibold" aria-live="polite">{format(cursor, 'MMMM yyyy')}</h2>
      <div className="overflow-x-auto rounded-md border border-border bg-surface">
        <div className="grid min-w-[720px] grid-cols-7">
          {weekdays.map((d, i) => (
            <div key={d} className={cn('h-8 border-b border-border px-2 text-xs font-medium leading-8 text-fg-muted', i >= 5 && 'bg-surface-2')}>
              {d}
            </div>
          ))}
          {days.map((day) => {
            const iso = toIso(day)
            const away = approvedOn(iso).filter((r) => scopeIds.has(r.employee_id))
            const weekend = isWeekend(day)
            const inMonth = isSameMonth(day, cursor)
            return (
              <div
                key={iso}
                className={cn(
                  'min-h-24 border-b border-r border-border p-1.5 [&:nth-child(7n+7)]:border-r-0',
                  weekend && 'bg-surface-2',
                  !inMonth && 'opacity-50',
                )}
              >
                <span
                  className={cn(
                    'mb-1 inline-flex size-6 items-center justify-center rounded-full text-sm tabular-nums',
                    iso === today ? 'bg-accent font-medium text-accent-fg' : 'text-fg-muted',
                  )}
                >
                  {format(day, 'd')}
                </span>
                <ul className="flex flex-col gap-1">
                  {away.slice(0, MAX_CHIPS).map((r) => {
                    const name = personName(r.employee_id)
                    return (
                      <li
                        key={r.id}
                        title={`${name}: ${shortTypeName(typeName(r.leave_type_id))} leave${r.half_day !== 'none' ? ' (half day)' : ''}`}
                        className="flex items-center gap-1 rounded bg-accent-soft py-0.5 pl-0.5 pr-1.5 text-xs text-accent"
                      >
                        <Avatar name={name} size="sm" className="size-5 bg-surface text-xs" />
                        <span className="truncate">{name.split(' ')[0]}</span>
                      </li>
                    )
                  })}
                  {away.length > MAX_CHIPS && (
                    <li className="px-1 text-xs text-fg-muted" title={away.slice(MAX_CHIPS).map((r) => personName(r.employee_id)).join(', ')}>
                      +{away.length - MAX_CHIPS} more
                    </li>
                  )}
                </ul>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
