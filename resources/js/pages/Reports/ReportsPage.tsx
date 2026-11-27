import { router } from '@inertiajs/react'
import { Download, Printer } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { PageHeader } from '../../components/shared/PageHeader'
import { Button, Input, NativeSelect } from '../../components/ui'
import { cn } from '../../lib/cn'
import { useShared } from '../../inertia/props'
import { TableView } from './tables'
import { DepartmentView, SheetView, StatementView, SummaryView } from './views'
import type { Filters, ReportsProps, TabKey } from './types'

type Section = {
  title: string
  items: { key: TabKey; label: string; payroll?: boolean }[]
}
const SECTIONS: Section[] = [
  {
    title: 'Attendance',
    items: [
      { key: 'att_summary', label: 'Monthly summary' },
      { key: 'att_daily', label: 'Daily attendance' },
      { key: 'late_early', label: 'Late and early leave' },
      { key: 'sheet', label: 'Month sheet' },
    ],
  },
  {
    title: 'Leave',
    items: [
      { key: 'leave_register', label: 'Leave register' },
      { key: 'leave_balance', label: 'Leave balance' },
    ],
  },
  { title: 'People', items: [{ key: 'headcount', label: 'Headcount' }] },
  {
    title: 'Payroll',
    items: [
      { key: 'summary', label: 'Payroll summary' },
      { key: 'department', label: 'Department cost' },
      { key: 'statement', label: 'Employee statement' },
      { key: 'salary_history', label: 'Salary changes', payroll: true },
      { key: 'tds', label: 'Monthly tax (TDS)', payroll: true },
    ],
  },
]
const TEAM_KEYS: TabKey[] = ['sheet', 'att_summary', 'att_daily', 'late_early', 'leave_register', 'leave_balance']
const MONTH_TABS: TabKey[] = ['sheet', 'att_summary', 'tds', 'department']
const RANGE_TABS: TabKey[] = ['late_early', 'leave_register', 'headcount', 'salary_history']
const PEOPLE_TABS: TabKey[] = ['sheet', 'att_summary', 'att_daily', 'late_early', 'leave_register', 'leave_balance', 'salary_history', 'tds']

type Patch = Omit<Partial<Filters>, 'month'> & { month?: string }
const pad = (n: number) => String(n).padStart(2, '0')

export default function ReportsPage() {
  const p = useShared<ReportsProps>()
  const { scope, filters, summary, department, statement, sheet, employees, departments, teams, tax_years, report, meta, can_payroll } = p
  const tab: TabKey = scope === 'me' ? 'statement' : filters.tab
  const month = `${filters.year}-${pad(filters.month)}`
  const [search, setSearch] = useState(filters.q)

  const base = scope === 'team' ? 'team.sheet' : scope === 'me' ? 'me.statement' : 'reports.index'
  const query = (patch: Patch) => {
    const next = { ...filters, month, page: 1, ...patch }
    return {
      tab: scope === 'me' ? undefined : next.tab,
      from: next.from ?? undefined,
      to: next.to ?? undefined,
      date: next.date,
      asof: next.asof,
      page: next.page > 1 ? next.page : undefined,
      month: next.month,
      tax_year: next.tax_year ?? undefined,
      employee: next.employee ?? undefined,
      department: next.department === 'all' ? undefined : next.department,
      team: next.team === 'all' ? undefined : next.team,
      q: next.q || undefined,
    }
  }
  const visit = (patch: Patch) =>
    router.get(route(base), query(patch), {
      preserveState: true,
      preserveScroll: true,
      replace: true,
    })

  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const id = window.setTimeout(() => visit({ q: search.trim() }), 300)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const csvRoute: Record<string, [string, Record<string, unknown>]> = {
    summary: ['reports.summary.csv', {}],
    department: ['reports.department.csv', { month }],
    statement: [
      scope === 'me' ? 'me.statement.csv' : 'reports.statement.csv',
      {
        tax_year: filters.tax_year ?? statement?.tax_year,
        employee: filters.employee ?? undefined,
      },
    ],
    sheet: [scope === 'team' ? 'team.sheet.csv' : 'reports.sheet.csv', query({}) as Record<string, unknown>],
  }
  const isTable = !csvRoute[tab]
  const [name, args]: [string, Record<string, unknown>] = isTable
    ? [
        scope === 'team' ? 'team.export' : 'reports.export',
        {
          report: tab,
          ...(query({}) as Record<string, unknown>),
          page: undefined,
          tab: undefined,
        },
      ]
    : csvRoute[tab]
  const csvDisabled = (tab === 'statement' && !statement) || (tab === 'sheet' && !sheet?.rows.length) || (isTable && !report?.rows.length)

  const monthInput = (
    <Input type="month" aria-label="Month" value={month} onChange={(e) => e.target.value && visit({ month: e.target.value })} className="w-40" />
  )
  const taxYears = tax_years.length ? tax_years : statement ? [statement.tax_year] : []

  const title = scope === 'me' ? 'My statement' : scope === 'team' ? 'Team reports' : 'Reports'
  const description =
    scope === 'me'
      ? 'Year-to-date pay for the tax year, from approved payroll.'
      : scope === 'team'
        ? 'Attendance and leave of the people you lead.'
        : 'Numbers come from approved and paid payroll, held items excluded.'

  const actions = (
    <>
      {tab === 'statement' && (
        <Button icon={<Printer size={16} />} onClick={() => window.print()} disabled={!statement} className="print:hidden">
          Print
        </Button>
      )}
      {csvDisabled ? (
        <span className="print:hidden">
          <Button icon={<Download size={16} />} disabled={csvDisabled}>
            Export CSV
          </Button>
        </span>
      ) : (
        <a href={route(name, args)} download aria-disabled={csvDisabled} className="print:hidden">
          <Button icon={<Download size={16} />} disabled={csvDisabled}>
            Export CSV
          </Button>
        </a>
      )}
    </>
  )

  const statementControls = (
    <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">
      {scope === 'all' && (
        <NativeSelect aria-label="Employee" value={filters.employee ?? ''} onChange={(e) => visit({ employee: e.target.value || null })} className="w-56">
          <option value="">Choose an employee</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} ({e.code})
            </option>
          ))}
        </NativeSelect>
      )}
      {taxYears.length > 0 && (
        <NativeSelect
          aria-label="Tax year"
          value={String(filters.tax_year ?? statement?.tax_year ?? '')}
          onChange={(e) => visit({ tax_year: Number(e.target.value) })}
          className="w-40"
        >
          {taxYears.map((y) => (
            <option key={y} value={y}>
              Tax year {y}-{String(y + 1).slice(2)}
            </option>
          ))}
        </NativeSelect>
      )}
    </div>
  )

  const range = meta?.range
  const sheetControls = (
    <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">
      {MONTH_TABS.includes(tab) && monthInput}
      {tab === 'att_daily' && (
        <Input type="date" aria-label="Date" value={filters.date} onChange={(e) => e.target.value && visit({ date: e.target.value })} className="w-40" />
      )}
      {tab === 'leave_balance' && (
        <Input type="date" aria-label="As of" value={filters.asof} onChange={(e) => e.target.value && visit({ asof: e.target.value })} className="w-40" />
      )}
      {RANGE_TABS.includes(tab) && (
        <>
          <Input
            type="date"
            aria-label="From"
            value={tab === 'salary_history' ? (filters.from ?? '') : (filters.from ?? range?.[0] ?? '')}
            onChange={(e) => visit({ from: e.target.value || null })}
            className="w-40"
          />
          <span className="text-sm text-fg-muted">to</span>
          <Input
            type="date"
            aria-label="To"
            value={tab === 'salary_history' ? (filters.to ?? '') : (filters.to ?? range?.[1] ?? '')}
            onChange={(e) => visit({ to: e.target.value || null })}
            className="w-40"
          />
        </>
      )}
      {PEOPLE_TABS.includes(tab) && (
        <Input aria-label="Search people" placeholder="Search people" value={search} onChange={(e) => setSearch(e.target.value)} className="w-48" />
      )}
      {scope === 'all' && (
        <NativeSelect aria-label="Department" value={filters.department} onChange={(e) => visit({ department: e.target.value })} className="w-44">
          <option value="all">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </NativeSelect>
      )}
      {teams.length > 0 && PEOPLE_TABS.includes(tab) && (
        <NativeSelect aria-label="Team" value={filters.team} onChange={(e) => visit({ team: e.target.value })} className="w-44">
          <option value="all">All teams</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </NativeSelect>
      )}
    </div>
  )

  return (
    <div className="mx-auto max-w-content">
      <PageHeader title={title} description={description} actions={actions} />
      <div className="flex flex-col gap-6 md:flex-row">
        {scope !== 'me' && (
          <nav aria-label="Reports" className="shrink-0 space-y-4 md:w-48 print:hidden">
            {SECTIONS.map((sec) => {
              const items = sec.items.filter((i) => (scope === 'team' ? TEAM_KEYS.includes(i.key) : !i.payroll || can_payroll))
              if (items.length === 0) return null
              return (
                <div key={sec.title}>
                  <div className="mb-1 text-xs font-medium uppercase tracking-wide text-fg-subtle">{sec.title}</div>
                  <ul className="space-y-0.5">
                    {items.map((i) => (
                      <li key={i.key}>
                        <button
                          type="button"
                          aria-current={tab === i.key ? 'page' : undefined}
                          onClick={() =>
                            router.get(
                              route(base),
                              { tab: i.key },
                              {
                                preserveScroll: true,
                              },
                            )
                          }
                          className={cn(
                            'w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                            tab === i.key ? 'bg-accent-soft font-medium text-accent' : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
                          )}
                        >
                          {i.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </nav>
        )}
        <div className="min-w-0 flex-1">
          {tab === 'summary' && summary && <SummaryView months={summary} />}
          {tab === 'department' && (
            <>
              <div className="mb-3 print:hidden">{monthInput}</div>
              {department && <DepartmentView report={department} />}
            </>
          )}
          {tab === 'statement' && (
            <>
              {statementControls}
              {statement ? (
                <StatementView statement={statement} />
              ) : (
                <p className="py-8 text-center text-fg-muted">Choose an employee to see their statement.</p>
              )}
            </>
          )}
          {tab === 'sheet' && (
            <>
              {sheetControls}
              {sheet && <SheetView sheet={sheet} />}
            </>
          )}
          {isTable && (
            <>
              {sheetControls}
              {report && meta && <TableView report={report} meta={meta} onPage={(page) => visit({ page })} />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
