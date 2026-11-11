import { MoneyCell } from '../../components/shared/MoneyCell'
import { Card, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { cn } from '../../lib/cn'
import type { BankAccount, ContractorClaim, Employee } from '../../types'
import { COMPANY, hoursText, monthLabel, type AuditRow } from './helpers'

export interface Week {
  label: string
  minutes: number
  days: number
}

export interface ClaimDetailProps {
  claim: ContractorClaim
  employee: Employee
  lead: { id: string; name: string } | null
  bank: BankAccount | null
  weeks: Week[]
  audit: AuditRow[]
}

/** The printable claim sheet, shared by the detail page and the bare print route. */
export function ClaimSheet({ claim, employee, bank, weeks }: Pick<ClaimDetailProps, 'claim' | 'employee' | 'bank' | 'weeks'>) {
  const diff = claim.claimed_minutes - claim.tracked_minutes
  const period = monthLabel(claim.year, claim.month)
  return (
    <Card className="claim-print p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xl font-semibold">Contractor claim</p>
          <p className="text-sm text-fg-muted">{period}</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-medium">{COMPANY.name}</p>
          <p className="text-fg-muted">Claim for services</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-fg-muted">Contractor</p>
          <p className="mt-1 font-medium">{employee.name}</p>
          <p className="text-sm text-fg-muted">{employee.designation}</p>
          <p className="text-sm text-fg-muted">{employee.code}</p>
        </div>
        <div className="sm:justify-self-end">
          <p className="text-xs font-medium text-fg-muted">Pay to</p>
          {bank ? (
            <>
              <p className="mt-1 font-medium">{bank.account_name}</p>
              <p className="text-sm text-fg-muted">
                {bank.bank}, {bank.branch}
              </p>
              <p className="font-mono text-sm text-fg-muted">Acct {bank.account_no}</p>
            </>
          ) : (
            <p className="mt-1 text-sm text-fg-muted">No bank account on file.</p>
          )}
        </div>
      </div>

      {
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-border p-3">
            <p className="text-sm text-fg-muted">Tracked time</p>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{hoursText(claim.tracked_minutes)}</p>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-sm text-fg-muted">Claimed hours</p>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{hoursText(claim.claimed_minutes)}</p>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-sm text-fg-muted">Difference</p>
            <p className={cn('mt-1 font-mono text-lg font-semibold tabular-nums', diff > 0 ? 'text-warning' : 'text-fg')}>
              {diff === 0 ? 'Matches' : `${diff > 0 ? '+' : '-'}${hoursText(Math.abs(diff))}`}
            </p>
          </div>
        </div>
      }

      <div className="mt-6">
        <h2 className="mb-2 text-base font-semibold">Tracked hours by week</h2>
        {weeks.length === 0 ? (
          <p className="text-sm text-fg-muted">
            No daily attendance is stored for this period. The total above is the figure recorded when the claim was generated.
          </p>
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>Week</Th>
                <Th numeric>Days worked</Th>
                <Th numeric>Hours</Th>
              </tr>
            </Thead>
            <Tbody>
              {weeks.map((w) => (
                <Tr key={w.label}>
                  <Td>{w.label}</Td>
                  <Td numeric>{w.days}</Td>
                  <Td numeric>{hoursText(w.minutes)}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </div>

      <dl className="ml-auto mt-6 flex w-full max-w-xs flex-col gap-1.5 text-sm">
        {claim.fixed_amount === null ? (
          <>
            <div className="flex justify-between">
              <dt className="text-fg-muted">Rate</dt>
              <dd>
                <MoneyCell amount={claim.rate} currency="BDT" />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-fg-muted">Hours claimed</dt>
              <dd className="font-mono tabular-nums">{(claim.claimed_minutes / 60).toFixed(2)}</dd>
            </div>
          </>
        ) : (
          <div className="flex justify-between">
            <dt className="text-fg-muted">Fixed monthly amount</dt>
            <dd>
              <MoneyCell amount={claim.fixed_amount} currency="BDT" />
            </dd>
          </div>
        )}
        <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
          <dt>Total</dt>
          <dd>
            <MoneyCell amount={claim.total} currency="BDT" />
          </dd>
        </div>
      </dl>
    </Card>
  )
}
