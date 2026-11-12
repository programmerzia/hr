import { Ellipsis, FileText, Laptop, Landmark, Plus, Receipt, Wallet, Clock } from 'lucide-react'
import { useState } from 'react'
import { Link } from '@inertiajs/react'
import { Bars } from '../../components/charts/Bars'
import { HeatStrip } from '../../components/charts/HeatStrip'
import { EmptyTable } from '../../components/shared/EmptyTable'
import { MoneyCell } from '../../components/shared/MoneyCell'
import { StatusBadge } from '../../components/shared/StatusBadge'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  IconButton,
  Stat,
  Table,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '../../components/ui'
import { useBreadcrumb } from '../../app/pageTitle'
import { formatDate, formatDuration } from '../../lib/format'
import { presenceTone } from '../../lib/status'
import { router } from '@inertiajs/react'
import { Credentials } from '../../components/shared/Credentials'
import { useCan, useShared } from '../../inertia/props'
import type { BankAccount, Employee, EmployeeAsset, EmployeeDocument, OnboardingChecklist, SalaryStructure, Team, User } from '../../types'
import { formatHours, useAttendanceHeat, useMonthWeekHours } from '../Attendance/useAttendanceSeries'
import { maskAccount, roleLabels, typeLabels } from './helpers'
import {
  AddAssetDialog,
  AddDocumentDialog,
  ChangeStatusDialog,
  docKindLabel,
  EditBankDialog,
  EditEmployeeDialog,
  NewStructureDialog,
  ResetPasswordDialog,
} from './ProfileDialogs'

interface LeaveRow {
  id: string
  name: string
  unlimited: boolean
  entitled: number
  used: number
  pending: number
  available: number | null
}

interface Props {
  employee: Employee
  department_name: string | null
  teams: Team[]
  team: Team | null
  lead: { id: string; name: string } | null
  user: User | null
  salary: SalaryStructure[] | null
  bank: BankAccount | null
  documents: EmployeeDocument[] | null
  assets: EmployeeAsset[]
  checklist: OnboardingChecklist[]
  history: { id: string; effective_on: string; kind: string; text: string }[]
  presence: string
  leave_balances: LeaveRow[]
  settlement: { run_id: string | null } | null
  credentials: { email: string; temporary_password: string; context: 'onboard' | 'reset' } | null
}

type DialogKind = 'reset' | 'status' | 'edit' | 'structure' | 'bank' | 'document' | 'asset' | null

function Details({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-2.5 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-fg-muted">{k}</dt>
          <dd className="min-w-0 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

export default function ProfilePage() {
  const p = useShared<Props>()
  const { employee, team, lead } = p
  const canManage = useCan('manage_people')
  const [dialog, setDialog] = useState<DialogKind>(null)
  useBreadcrumb([{ label: 'People', to: route('people.directory') }, { label: employee.name }])

  const canSeePay = p.salary !== null
  const close = (o: boolean) => !o && setDialog(null)

  return (
    <div className="mx-auto max-w-content">
      {p.credentials?.context === 'onboard' && (
        <Card className="mb-6">
          <CardBody className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">Sign-in details</h2>
            <Credentials email={p.credentials.email} password={p.credentials.temporary_password} />
          </CardBody>
        </Card>
      )}
      <header className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar name={employee.name} size="xxl" presence={presenceTone(p.presence)} className="m-1" />
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold">{employee.name}</h1>
              <p className="text-base text-fg-muted">{employee.designation}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {team && <Badge variant="accent">{team.name}</Badge>}
                <StatusBadge status={employee.status} />
              </div>
            </div>
          </div>
          {canManage && (
          <div className="flex items-center gap-2">
            <Button onClick={() => setDialog('edit')}>Edit</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton label="More actions"><Ellipsis size={16} /></IconButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setDialog('status')}>Change status</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDialog('edit')}>Edit details</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDialog('reset')}>Reset password</DropdownMenuItem>
                {p.settlement && (
                  <DropdownMenuItem
                    onSelect={() =>
                      p.settlement?.run_id
                        ? router.get(route('payroll.runs.show', p.settlement.run_id))
                        : router.post(route('payroll.runs.store'), { kind: 'settlement', employee_id: employee.id }, { preserveScroll: true })
                    }
                  >
                    {p.settlement.run_id ? 'Open final settlement' : 'Create final settlement'}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          )}
        </div>
        {p.settlement && !p.settlement.run_id && (
          <p className="mt-3 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-fg-muted">
            {employee.name} left on {formatDate(employee.exited_on ?? '')}. Create the final settlement from the actions menu to pay the last salary and unused leave.
          </p>
        )}
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 border-t border-border pt-4 text-sm">
          <div className="flex gap-2">
            <dt className="text-fg-muted">Code</dt>
            <dd className="font-mono">{employee.code}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-fg-muted">Joined</dt>
            <dd>{formatDate(employee.joined_on)}</dd>
          </div>
          {lead && (
            <div className="flex gap-2">
              <dt className="text-fg-muted">Lead</dt>
              <dd>{lead.name}</dd>
            </div>
          )}
        </dl>
      </header>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="employment">Employment</TabsTrigger>
          {canSeePay && <TabsTrigger value="compensation">Compensation</TabsTrigger>}
          {canSeePay && <TabsTrigger value="bank">Bank</TabsTrigger>}
          {p.documents && <TabsTrigger value="documents">Documents</TabsTrigger>}
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><OverviewTab /></TabsContent>
        <TabsContent value="employment"><EmploymentTab /></TabsContent>
        {canSeePay && <TabsContent value="compensation"><CompensationTab employee={employee} onNew={() => setDialog('structure')} /></TabsContent>}
        {canSeePay && <TabsContent value="bank"><BankTab onEdit={() => setDialog('bank')} /></TabsContent>}
        {p.documents && <TabsContent value="documents"><DocumentsTab onAdd={() => setDialog('document')} /></TabsContent>}
        <TabsContent value="assets"><AssetsTab onAdd={() => setDialog('asset')} /></TabsContent>
        <TabsContent value="attendance">
          <AttendanceTab />
        </TabsContent>
        <TabsContent value="leave"><LeaveTab /></TabsContent>
      </Tabs>

      {dialog === 'reset' && <ResetPasswordDialog open onOpenChange={close} employee={employee} />}
      {dialog === 'status' && <ChangeStatusDialog open onOpenChange={close} employee={employee} />}
      {dialog === 'edit' && <EditEmployeeDialog open onOpenChange={close} employee={employee} />}
      {dialog === 'structure' && <NewStructureDialog open onOpenChange={close} employee={employee} current={p.salary?.[0]} />}
      {dialog === 'bank' && <EditBankDialog open onOpenChange={close} employee={employee} bank={p.bank} />}
      {dialog === 'document' && <AddDocumentDialog open onOpenChange={close} employee={employee} />}
      {dialog === 'asset' && <AddAssetDialog open onOpenChange={close} employee={employee} />}
    </div>
  )
}

function OverviewTab() {
  const { employee: e, department_name, team, lead, user, checklist } = useShared<Props>()
  const canManage = useCan('manage_people')
  const dept = department_name ? { name: department_name } : undefined
  const done = checklist.filter((c) => c.done).length
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Details" />
        <CardBody>
          <Details
            rows={[
              ['Email', e.email],
              ['Phone', e.phone],
              ['National ID', <span key="nid" className="font-mono">{e.nid}</span>],
              ['Department', dept?.name ?? ''],
              ['Team', team?.name ?? 'None'],
              ['Team lead', lead ? <Link key="l" href={route('people.profile', lead.id)} className="text-accent hover:underline">{lead.name}</Link> : 'None'],
              ['Employment type', typeLabels[e.employment_type]],
              ['Sign-in role', user ? roleLabels[user.role] : ''],
              ['Joined', formatDate(e.joined_on)],
              ...(e.probation_until ? ([['Probation until', formatDate(e.probation_until)]] as [string, string][]) : []),
              ...(e.exited_on ? ([['Exited', formatDate(e.exited_on)]] as [string, string][]) : []),
            ]}
          />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Onboarding checklist" actions={checklist.length > 0 ? <span className="text-sm text-fg-muted">{done} of {checklist.length} done</span> : undefined} />
        {checklist.length === 0 ? (
          <EmptyState title="No checklist" description="This person was added before checklists were tracked." />
        ) : (
          <CardBody className="flex flex-col gap-3">
            {checklist.map((c) => (
              <Checkbox key={c.id} checked={c.done} disabled={!canManage} onCheckedChange={() => router.patch(route('people.checklist.toggle', c.id), {}, { preserveScroll: true })} label={c.label} />
            ))}
          </CardBody>
        )}
      </Card>
    </div>
  )
}

function EmploymentTab() {
  const events = useShared<Props>().history
  return (
    <Card>
      <CardHeader title="Designation and status history" />
      {events.length === 0 ? (
        <EmptyState title="No history yet" description="Changes to designation, team and status will be listed here." />
      ) : (
        <ol className="divide-y divide-border">
          {events.map((ev) => (
            <li key={ev.id} className="flex items-baseline justify-between gap-4 px-4 py-2.5 text-sm">
              <span>{ev.text}</span>
              <span className="shrink-0 text-fg-muted">{formatDate(ev.effective_on)}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}

function CompensationTab({ employee: e, onNew }: { employee: Employee; onNew: () => void }) {
  const canManage = useCan('manage_people')
  const history = useShared<Props>().salary ?? []
  const hourly = e.employment_type === 'contractor'
  const today = new Date().toISOString().slice(0, 10)
  const current = history.find((x) => x.effective_from <= today) ?? history[history.length - 1]
  return (
    <div className="flex flex-col gap-4">
      {current && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {hourly ? (
            <Stat icon={Clock} label="Hourly rate" value={<MoneyCell amount={current.hourly_rate} className="text-left" />} />
          ) : (
            <>
              <Stat icon={Wallet} label="Gross per month" value={<MoneyCell amount={current.gross} className="text-left" />} />
              <Stat icon={Landmark} label="Provident fund" value={`${current.pf_percent}%`} />
              <Stat icon={Receipt} label="Monthly tax" value={<MoneyCell amount={current.tax_monthly} className="text-left" />} />
            </>
          )}
        </div>
      )}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Salary structures</h2>
        {canManage && <Button icon={<Plus size={16} />} onClick={onNew}>New structure</Button>}
      </div>
      {history.length === 0 ? (
        <EmptyTable title="No salary structure" description="Add the first structure to set pay for this person." action={canManage ? <Button variant="primary" onClick={onNew}>New structure</Button> : undefined} />
      ) : (
        <Table>
          <Thead>
            <tr>
              <Th>Effective from</Th>
              {hourly ? <Th numeric>Hourly rate</Th> : (
                <>
                  <Th numeric>Basic</Th>
                  <Th numeric>House rent</Th>
                  <Th numeric>Medical</Th>
                  <Th numeric>Conveyance</Th>
                  <Th numeric>PF</Th>
                  <Th numeric>Tax</Th>
                  <Th numeric>Gross</Th>
                </>
              )}
            </tr>
          </Thead>
          <Tbody>
            {history.map((s, i) => (
              <Tr key={s.id}>
                <Td>{formatDate(s.effective_from)}{i === 0 && <span className="ml-2 text-fg-muted">Current</span>}</Td>
                {hourly ? <Td numeric>{s.hourly_rate}</Td> : (
                  <>
                    <Td numeric>{s.basic.toLocaleString('en-IN')}</Td>
                    <Td numeric>{s.house_rent.toLocaleString('en-IN')}</Td>
                    <Td numeric>{s.medical.toLocaleString('en-IN')}</Td>
                    <Td numeric>{s.conveyance.toLocaleString('en-IN')}</Td>
                    <Td numeric>{s.pf_percent}%</Td>
                    <Td numeric>{s.tax_monthly.toLocaleString('en-IN')}</Td>
                    <Td numeric className="font-medium">{s.gross.toLocaleString('en-IN')}</Td>
                  </>
                )}
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
      <p className="text-sm text-fg-muted">Amounts in BDT. Structures are append-only, so payroll can always trace which one applied.</p>
    </div>
  )
}

function BankTab({ onEdit }: { onEdit: () => void }) {
  const bank = useShared<Props>().bank
  const canManage = useCan('manage_people')
  return (
    <Card>
      <CardHeader title="Bank account" actions={canManage ? <Button onClick={onEdit}>{bank ? 'Edit' : 'Add account'}</Button> : undefined} />
      {bank ? (
        <CardBody>
          <Details
            rows={[
              ['Bank', bank.bank],
              ['Branch', bank.branch],
              ['Account name', bank.account_name],
              ['Account number', <span key="a" className="font-mono">{maskAccount(bank.account_no)}</span>],
              ['Routing number', <span key="r" className="font-mono">{bank.routing_no}</span>],
            ]}
          />
        </CardBody>
      ) : (
        <EmptyState title="No bank account" description="Add one so salary or claims can be paid." />
      )}
    </Card>
  )
}

function DocumentsTab({ onAdd }: { onAdd: () => void }) {
  const docs = useShared<Props>().documents ?? []
  const canManage = useCan('manage_people')
  return (
    <div className="flex flex-col gap-3">
      {canManage && <div className="flex justify-end"><Button icon={<Plus size={16} />} onClick={onAdd}>Add document</Button></div>}
      {docs.length === 0 ? (
        <EmptyTable icon={FileText} title="No documents" description="Upload an ID copy, contract or certificate." />
      ) : (
        <Table>
          <Thead><tr><Th>Name</Th><Th>Kind</Th><Th>Uploaded</Th></tr></Thead>
          <Tbody>
            {docs.map((d) => (
              <Tr key={d.id}><Td><a href={route('people.documents.download', [d.employee_id, d.id])} className="text-accent hover:underline">{d.name}</a></Td><Td>{docKindLabel(d.kind)}</Td><Td className="text-fg-muted">{formatDate(d.uploaded_at)}</Td></Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  )
}

function AssetsTab({ onAdd }: { onAdd: () => void }) {
  const assets = useShared<Props>().assets
  const canManage = useCan('manage_people')
  return (
    <div className="flex flex-col gap-3">
      {canManage && <div className="flex justify-end"><Button icon={<Plus size={16} />} onClick={onAdd}>Assign asset</Button></div>}
      {assets.length === 0 ? (
        <EmptyTable icon={Laptop} title="No assets" description="Laptops, monitors and access cards assigned to this person show up here." />
      ) : (
        <Table>
          <Thead><tr><Th>Asset</Th><Th>Tag</Th><Th>Assigned</Th><Th>Returned</Th><Th>Status</Th></tr></Thead>
          <Tbody>
            {assets.map((a) => (
              <Tr key={a.id}>
                <Td>{a.name}</Td>
                <Td className="font-mono text-fg-muted">{a.tag}</Td>
                <Td className="text-fg-muted">{formatDate(a.assigned_on)}</Td>
                <Td className="text-fg-muted">{a.returned_on ? formatDate(a.returned_on) : ''}</Td>
                <Td><StatusBadge status={a.status} /></Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  )
}

function LeaveTab() {
  const balances = useShared<Props>().leave_balances
  const year = new Date().getFullYear()
  if (balances.length === 0) return <EmptyTable title="No leave balances" description={`No leave is set up for ${year}.`} />
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {balances.map((b) => (
        <Stat
          key={b.id}
          label={b.name}
          value={b.unlimited ? 'Unlimited' : `${b.available} of ${b.entitled}`}
          delta={{ value: `${b.used} used, ${b.pending} pending`, tone: 'neutral' }}
        />
      ))}
    </div>
  )
}

function AttendanceTab() {
  const employeeId = useShared<Props>().employee.id
  const cells = useAttendanceHeat(employeeId, 30)
  const month = useMonthWeekHours(employeeId)
  const worked = cells.filter((c) => c.value !== null && c.value > 0).length
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Last 30 days" actions={<span className="text-sm text-fg-muted">{worked} days worked</span>} />
        <CardBody>
          <HeatStrip cells={cells} height={40} aria-label={`${worked} days worked in the last 30 days`} />
          <p className="mt-2 text-xs text-fg-subtle">Darker means closer to a full day. Weekends and holidays are blank.</p>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={`${month.month} by week`} actions={<span className="font-mono text-sm tabular-nums text-fg-muted">{formatDuration(month.totalSeconds)}</span>} />
        <CardBody>
          <Bars
            data={month.data}
            series={[{ name: 'Worked' }]}
            height={96}
            format={formatHours}
            aria-label={`Hours worked per week in ${month.month}, ${formatDuration(month.totalSeconds)} in total`}
          />
        </CardBody>
      </Card>
    </div>
  )
}
