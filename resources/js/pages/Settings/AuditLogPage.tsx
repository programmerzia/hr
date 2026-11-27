import { router } from '@inertiajs/react'
import { useState } from 'react'
import { EmptyTable } from '../../components/shared/EmptyTable'
import { PageHeader } from '../../components/shared/PageHeader'
import { Button, Input, NativeSelect, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { useShared } from '../../inertia/props'
import { formatDate, formatTime } from '../../lib/format'

interface Entry {
  id: string
  at: string
  actor: string
  subject_type: string
  subject: string | null
  text: string
}

interface Filters {
  actor?: string
  type?: string
  from?: string
  to?: string
  q?: string
}

interface Props {
  entries: Entry[]
  meta: { page: number; last_page: number; total: number }
  filters: Filters
  actors: { id: string; name: string }[]
  types: string[]
}

const typeLabel = (t: string) => t.replace(/_/g, ' ')

export default function AuditLogPage() {
  const { entries, meta, filters, actors, types } = useShared<Props>()
  const [f, setF] = useState<Filters>({ actor: '', type: '', from: '', to: '', q: '', ...filters })
  const clean = (extra: Record<string, unknown> = {}) =>
    Object.fromEntries(Object.entries({ ...f, ...extra }).filter(([, v]) => v !== '' && v != null))
  const apply = (extra: Record<string, unknown> = {}) =>
    router.get(route('settings.audit-log.index'), clean(extra), { preserveScroll: true, preserveState: true })
  const set = (k: keyof Filters) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  return (
    <div className="mx-auto max-w-content">
      <PageHeader
        title="Audit log"
        description="Who did what, and when, across the app."
        actions={
          <a href={route('settings.audit-log.export', clean())} className="inline-flex h-9 items-center rounded-md border border-border-strong bg-surface px-3 text-sm font-medium hover:bg-surface-2">
            Export CSV
          </a>
        }
      />
      <form
        className="mb-4 grid grid-cols-2 items-end gap-3 md:grid-cols-6"
        onSubmit={(e) => {
          e.preventDefault()
          apply({ page: undefined })
        }}
      >
        <NativeSelect aria-label="Person" value={f.actor ?? ''} onChange={set('actor')}>
          <option value="">Anyone</option>
          {actors.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="Kind" value={f.type ?? ''} onChange={set('type')}>
          <option value="">All kinds</option>
          {types.map((t) => (
            <option key={t} value={t}>{typeLabel(t)}</option>
          ))}
        </NativeSelect>
        <Input type="date" aria-label="From" value={f.from ?? ''} onChange={set('from')} />
        <Input type="date" aria-label="To" value={f.to ?? ''} onChange={set('to')} />
        <Input type="search" aria-label="Search" placeholder="Search text" value={f.q ?? ''} onChange={set('q')} />
        <Button type="submit" variant="primary">Filter</Button>
      </form>

      {entries.length === 0 ? (
        <EmptyTable title="No entries" description="Nothing matches these filters." />
      ) : (
        <Table>
          <Thead>
            <tr>
              <Th>When</Th>
              <Th>Who</Th>
              <Th>Kind</Th>
              <Th>What</Th>
            </tr>
          </Thead>
          <Tbody>
            {entries.map((e) => (
              <Tr key={e.id}>
                <Td className="num text-fg-muted">{formatDate(e.at)} {formatTime(e.at)}</Td>
                <Td>{e.actor}</Td>
                <Td className="text-fg-muted">{typeLabel(e.subject_type)}{e.subject ? `: ${e.subject}` : ''}</Td>
                <Td className="max-w-xl truncate" title={e.text}>{e.text}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
      <div className="mt-3 flex items-center justify-between text-sm text-fg-muted">
        <span className="num">{meta.total} entries, page {meta.page} of {meta.last_page}</span>
        <div className="flex gap-2">
          <Button size="sm" disabled={meta.page <= 1} onClick={() => apply({ page: meta.page - 1 })}>Previous</Button>
          <Button size="sm" disabled={meta.page >= meta.last_page} onClick={() => apply({ page: meta.page + 1 })}>Next</Button>
        </div>
      </div>
    </div>
  )
}
