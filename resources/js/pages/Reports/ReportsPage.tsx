import { router } from '@inertiajs/react'
import { Download, Printer } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { PageHeader } from '../../components/shared/PageHeader'
import { Button, Input, NativeSelect, Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui'
import { useShared } from '../../inertia/props'
import { DepartmentView, SheetView, StatementView, SummaryView } from './views'
import type { Filters, ReportsProps } from './types'

type Patch = Omit<Partial<Filters>, 'month'> & { month?: string }
const pad = (n: number) => String(n).padStart(2, '0')

export default function ReportsPage() {
  const p = useShared<ReportsProps>()
  const { scope, filters, summary, department, statement, sheet, employees, departments, teams, tax_years } = p
  const tab = scope === 'all' ? filters.tab : scope === 'me' ? 'statement' : 'sheet'
  const month = `${filters.year}-${pad(filters.month)}`
  const [search, setSearch] = useState(filters.q)

  const base = scope === 'team' ? 'team.sheet' : scope === 'me' ? 'me.statement' : 'reports.index'
  const query = (patch: Patch) => {
    const next = { ...filters, month, ...patch }
    return {
      tab: scope === 'all' ? next.tab : undefined,
      month: next.month,
      tax_year: next.tax_year ?? undefined,
      employee: next.employee ?? undefined,
      department: next.department === 'all' ? undefined : next.department,
      team: next.team === 'all' ? undefined : next.team,
      q: next.q || undefined,
    }
  }
  const visit = (patch: Patch) =>
    router.get(route(base), query(patch), { preserveState: true, preserveScroll: true, replace: true })

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
    statement: [scope === 'me' ? 'me.statement.csv' : 'reports.statement.csv', { tax_year: filters.tax_year ?? statement?.tax_year, employee: filters.employee ?? undefined }],
    sheet: [scope === 'team' ? 'team.sheet.csv' : 'reports.sheet.csv', query({}) as Record<string, unknown>],
  }
  const [name, args] = csvRoute[tab]
  const csvDisabled = (tab === 'statement' && !statement) || (tab === 'sheet' && !sheet?.rows.length)

  const monthInput = (
    <Input type="month" aria-label="Month" value={month} onChange={(e) => e.target.value && visit({ month: e.target.value })} className="w-40" />
  )
  const taxYears = tax_years.length ? tax_years : statement ? [statement.tax_year] : []

  const title = scope === 'me' ? 'My statement' : scope === 'team' ? 'Month sheet' : 'Reports'
  const description =
    scope === 'me'
      ? 'Year-to-date pay for the tax year, from approved payroll.'
      : scope === 'team'
        ? 'Attendance of your teams, one row per person.'
        : 'Numbers come from approved and paid payroll, held items excluded.'

  const actions = (
    <>
      {tab === 'statement' && (
        <Button icon={<Printer size={16} />} onClick={() => window.print()} disabled={!statement} className="print:hidden">
          Print
        </Button>
      )}
      <a href={route(name, args)} download aria-disabled={csvDisabled} className="print:hidden">
        <Button icon={<Download size={16} />} disabled={csvDisabled}>
          Export CSV
        </Button>
      </a>
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
    </div>
  )

  const sheetControls = (
    <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">
      {monthInput}
      <Input aria-label="Search people" placeholder="Search people" value={search} onChange={(e) => setSearch(e.target.value)} className="w-48" />
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
      {teams.length > 0 && (
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
      <Tabs value={tab} onValueChange={(v) => scope === 'all' && visit({ tab: v as Filters['tab'] })}>
        {scope === 'all' && (
          <TabsList className="print:hidden">
            <TabsTrigger value="summary">Payroll summary</TabsTrigger>
            <TabsTrigger value="department">Department cost</TabsTrigger>
            <TabsTrigger value="statement">Employee statement</TabsTrigger>
            <TabsTrigger value="sheet">Attendance sheet</TabsTrigger>
          </TabsList>
        )}
        <TabsContent value="summary">{summary && <SummaryView months={summary} />}</TabsContent>
        <TabsContent value="department">
          <div className="mb-3 print:hidden">{monthInput}</div>
          {department && <DepartmentView report={department} />}
        </TabsContent>
        <TabsContent value="statement">
          {statementControls}
          {statement ? <StatementView statement={statement} /> : <p className="py-8 text-center text-fg-muted">Choose an employee to see their statement.</p>}
        </TabsContent>
        <TabsContent value="sheet">
          {sheetControls}
          {sheet && <SheetView sheet={sheet} />}
        </TabsContent>
      </Tabs>
    </div>
  )
}
