import { Check, Pencil, X } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '../../components/shared/PageHeader'
import { Badge, IconButton, Input, Switch, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { isUnlimited, useLeaveStore } from '../../mock/stores/leave'
import type { LeaveType } from '../../types'

export function PolicyPage() {
  const leave = useLeaveStore()
  const [editing, setEditing] = useState<string | null>(null)
  const [quota, setQuota] = useState('')

  const startEdit = (t: LeaveType) => {
    setEditing(t.id)
    setQuota(String(t.annual_quota))
  }
  const save = (t: LeaveType) => {
    const n = Number(quota)
    if (Number.isFinite(n) && n >= 0) leave.updateLeaveType(t.id, { annual_quota: n })
    setEditing(null)
  }
  const invalid = !(Number.isFinite(Number(quota)) && Number(quota) >= 0 && quota.trim() !== '')

  return (
    <div className="mx-auto max-w-content">
      <PageHeader title="Leave policy" description="Yearly quotas and rules for each leave type. Changes apply to new requests." />
      <Table>
        <Thead>
          <tr>
            <Th>Leave type</Th>
            <Th numeric>Days per year</Th>
            <Th>Paid</Th>
            <Th>Carry forward</Th>
            <Th>Half day allowed</Th>
            <Th className="w-20" />
          </tr>
        </Thead>
        <Tbody>
          {leave.leaveTypes.map((t) => {
            const isEditing = editing === t.id
            return (
              <Tr key={t.id}>
                <Td className="font-medium">{t.name}</Td>
                <Td numeric>
                  {isEditing ? (
                    <Input
                      type="number"
                      min={0}
                      value={quota}
                      aria-label={`${t.name} days per year`}
                      aria-invalid={invalid || undefined}
                      onChange={(e) => setQuota(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !invalid) save(t)
                        if (e.key === 'Escape') setEditing(null)
                      }}
                      className="ml-auto h-7 w-20 text-right"
                      autoFocus
                    />
                  ) : isUnlimited(t) ? (
                    <Badge>Unlimited</Badge>
                  ) : (
                    t.annual_quota
                  )}
                </Td>
                <Td>
                  <Switch
                    checked={t.is_paid}
                    onCheckedChange={(v) => leave.updateLeaveType(t.id, { is_paid: v })}
                    aria-label={`${t.name} is paid`}
                  />
                </Td>
                <Td>
                  <Switch
                    checked={t.carry_forward}
                    onCheckedChange={(v) => leave.updateLeaveType(t.id, { carry_forward: v })}
                    aria-label={`${t.name} carries forward`}
                  />
                </Td>
                <Td>
                  <Switch
                    checked={t.allows_half_day}
                    onCheckedChange={(v) => leave.updateLeaveType(t.id, { allows_half_day: v })}
                    aria-label={`${t.name} allows half days`}
                  />
                </Td>
                <Td>
                  <div className="flex justify-end">
                    {isEditing ? (
                      <>
                        <IconButton label="Save quota" size="sm" disabled={invalid} onClick={() => save(t)}>
                          <Check size={16} />
                        </IconButton>
                        <IconButton label="Cancel edit" size="sm" onClick={() => setEditing(null)}>
                          <X size={16} />
                        </IconButton>
                      </>
                    ) : (
                      <IconButton label={`Edit ${t.name} quota`} size="sm" onClick={() => startEdit(t)}>
                        <Pencil size={16} />
                      </IconButton>
                    )}
                  </div>
                </Td>
              </Tr>
            )
          })}
        </Tbody>
      </Table>
      <p className="mt-3 text-sm text-fg-muted">A paid type with zero days is a type with no entitlement. An unpaid type with zero days has no limit.</p>
    </div>
  )
}
