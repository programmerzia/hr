import { ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import { EmptyTable } from '../../components/shared/EmptyTable'
import { Button, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { formatMoney } from '../../lib/format'
import type { Col, Row, SubTable, TableMeta, TableReport } from './types'

const NUMERIC = ['int', 'dec', 'hours', 'money', 'pct']

function cell(col: Col, v: string | number | null) {
  if (v === null || v === '' || v === undefined) return <span className="text-fg-subtle">-</span>
  switch (col.type) {
    case 'money':
      return formatMoney(Number(v))
    case 'dec':
      return Number(v).toFixed(2).replace(/\.00$/, '')
    case 'pct':
      return `${Number(v) > 0 ? '+' : ''}${v}%`
    default:
      return String(v)
  }
}

// The person column stays in view while a wide report scrolls sideways; the code moves under the name to save a column.
const STICKY = 'sticky left-0 z-[1] bg-surface shadow-[1px_0_0_rgb(var(--border))]'

function Grid({ columns: all, rows, totals }: { columns: Col[]; rows: Row[]; totals?: Row | null }) {
  const person = all.find((c) => c.key === 'name' || c.key === 'employee')?.key
  const merge = !!person && all.some((c) => c.key === 'code')
  const columns = merge ? all.filter((c) => c.key !== 'code') : all
  const sticky = (c: Col) => (c.key === person ? STICKY : '')
  const body = (c: Col, r: Row) =>
    merge && c.key === person && r.code ? (
      <span className="whitespace-nowrap">
        {cell(c, r[c.key])} <span className="num text-xs text-fg-subtle">{String(r.code)}</span>
      </span>
    ) : (
      cell(c, r[c.key])
    )
  return (
    <Table>
      <Thead>
        <Tr className="hover:bg-transparent">
          {columns.map((c) => (
            <Th
              key={c.key}
              numeric={NUMERIC.includes(c.type)}
              className={c.key === person ? 'sticky left-0 z-[1] bg-surface-2 shadow-[1px_0_0_rgb(var(--border))]' : undefined}
            >
              {c.label}
            </Th>
          ))}
        </Tr>
      </Thead>
      <Tbody>
        {rows.map((r, i) => (
          <Tr key={i}>
            {columns.map((c) => (
              <Td
                key={c.key}
                numeric={NUMERIC.includes(c.type)}
                className={[c.type === 'date' || c.type === 'datetime' ? 'num' : '', sticky(c)].join(' ').trim() || undefined}
              >
                {body(c, r)}
              </Td>
            ))}
          </Tr>
        ))}
        {totals && (
          <Tr className="font-medium hover:bg-transparent">
            {columns.map((c) => (
              <Td key={c.key} numeric={NUMERIC.includes(c.type)} className={sticky(c) || undefined}>
                {totals[c.key] === undefined || totals[c.key] === '' ? '' : cell(c, totals[c.key])}
              </Td>
            ))}
          </Tr>
        )}
      </Tbody>
    </Table>
  )
}

function Sub({ table }: { table: SubTable }) {
  if (table.rows.length === 0) return null
  return (
    <div className="mt-6 space-y-2">
      <h3 className="text-sm font-medium">{table.title}</h3>
      <Grid columns={table.columns} rows={table.rows} />
    </div>
  )
}

export function TableView({ report, meta, onPage }: { report: TableReport; meta: TableMeta; onPage: (page: number) => void }) {
  const inNow = report.extra?.in_now
  if (report.rows.length === 0 && !report.secondary?.rows.length) {
    return <EmptyTable icon={FileText} title="Nothing to show" description="No records match these filters." />
  }
  const pages = Math.max(1, Math.ceil(meta.total / meta.per))
  return (
    <div className="space-y-3">
      {inNow && (
        <p className="text-sm text-fg-muted">
          In now: <span className="num">{inNow.length}</span>
          {inNow.length > 0 && (
            <> ({inNow.map((p) => `${p.name}${p.status === 'On break' ? ' on break' : ''}${p.since ? ` since ${p.since}` : ''}`).join(', ')})</>
          )}
        </p>
      )}
      {report.extra?.note && <p className="text-xs text-fg-muted">{report.extra.note}</p>}
      <Grid columns={report.columns} rows={report.rows} totals={meta.page === pages ? report.totals : null} />
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm text-fg-muted print:hidden">
          <span className="num">
            Page {meta.page} of {pages} ({meta.total} rows)
          </span>
          <Button
            size="sm"
            variant="secondary"
            icon={<ChevronLeft size={14} />}
            disabled={meta.page <= 1}
            onClick={() => onPage(meta.page - 1)}
            aria-label="Previous page"
          />
          <Button
            size="sm"
            variant="secondary"
            icon={<ChevronRight size={14} />}
            disabled={meta.page >= pages}
            onClick={() => onPage(meta.page + 1)}
            aria-label="Next page"
          />
        </div>
      )}
      {report.secondary && <Sub table={report.secondary} />}
    </div>
  )
}
