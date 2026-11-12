import { router, useForm } from '@inertiajs/react'
import { Lock, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { ConfirmDialog } from '../../components/shared/ConfirmDialog'
import { HistoryPanel } from '../../components/shared/HistoryPanel'
import { PageHeader } from '../../components/shared/PageHeader'
import { Button, Card, CardBody, CardHeader, Field, IconButton, Input, NativeSelect, Table, Tbody, Td, Textarea, Th, Thead, Tr } from '../../components/ui'
import { useShared } from '../../inertia/props'
import { formatDate } from '../../lib/format'
import type { SettingsHistoryEntry, SettingsHoliday } from '../../types'
import { SettingsTabs } from './SettingsTabs'

export default function HolidaysPage() {
  const { year, holidays, history } = useShared<{ year: number; holidays: SettingsHoliday[]; history: SettingsHistoryEntry[] }>()
  const [removing, setRemoving] = useState<SettingsHoliday | null>(null)
  const add = useForm({ date: '', name: '' })
  const bulk = useForm({ lines: '' })
  const thisYear = new Date().getFullYear()
  const years = Array.from(new Set([thisYear - 1, thisYear, thisYear + 1, year])).sort()

  return (
    <div className="mx-auto max-w-content">
      <PageHeader
        title="Holidays"
        description="Company holidays are not working days: nobody is marked absent and they are left out of the daily rate when it uses working days."
        tabs={<SettingsTabs />}
        actions={
          <NativeSelect
            aria-label="Year"
            value={year}
            onChange={(e) => router.get(route('settings.holidays.index'), { year: e.target.value }, { preserveScroll: true })}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </NativeSelect>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-4">
          <Table>
            <Thead>
              <tr>
                <Th>Date</Th>
                <Th>Holiday</Th>
                <Th className="w-16" />
              </tr>
            </Thead>
            <Tbody>
              {holidays.length === 0 && (
                <Tr>
                  <Td colSpan={3} className="text-fg-muted">
                    No holidays in {year}.
                  </Td>
                </Tr>
              )}
              {holidays.map((h) => (
                <Tr key={h.id}>
                  <Td className="whitespace-nowrap">{formatDate(h.date)}</Td>
                  <Td className="font-medium">{h.name}</Td>
                  <Td>
                    <div className="flex justify-end">
                      {h.locked ? (
                        <span title="Payroll for this month is paid" className="p-1.5 text-fg-subtle">
                          <Lock size={16} aria-label="Locked: payroll paid" />
                        </span>
                      ) : (
                        <IconButton label={`Remove ${h.name}`} size="sm" onClick={() => setRemoving(h)}>
                          <Trash2 size={16} />
                        </IconButton>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          <HistoryPanel title="Last 10 changes" entries={history} />
        </div>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Add a holiday" />
            <CardBody>
              <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  add.post(route('settings.holidays.store'), { preserveScroll: true, onSuccess: () => add.reset() })
                }}
              >
                <Field label="Date" required error={add.errors.date}>
                  <Input type="date" value={add.data.date} onChange={(e) => add.setData('date', e.target.value)} />
                </Field>
                <Field label="Name" required error={add.errors.name}>
                  <Input value={add.data.name} onChange={(e) => add.setData('name', e.target.value)} />
                </Field>
                <Button type="submit" variant="primary" loading={add.processing}>
                  Add holiday
                </Button>
              </form>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Paste a list" />
            <CardBody>
              <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  bulk.post(route('settings.holidays.bulk'), { preserveScroll: true, onSuccess: () => bulk.reset() })
                }}
              >
                <Field label="One per line: date, then name" error={bulk.errors.lines} hint="Dates already on the calendar are skipped.">
                  <Textarea
                    rows={6}
                    placeholder={'2026-12-16  Victory Day\n2026-12-25  Christmas Day'}
                    value={bulk.data.lines}
                    onChange={(e) => bulk.setData('lines', e.target.value)}
                  />
                </Field>
                <Button type="submit" loading={bulk.processing}>
                  Add all
                </Button>
              </form>
            </CardBody>
          </Card>
        </div>
      </div>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove holiday"
        description={removing ? `Remove ${removing.name} on ${formatDate(removing.date)}? That day becomes a normal working day.` : ''}
        confirmLabel="Remove"
        destructive
        onConfirm={() => {
          if (removing) router.delete(route('settings.holidays.destroy', removing.id), { preserveScroll: true })
          setRemoving(null)
        }}
      />
    </div>
  )
}
