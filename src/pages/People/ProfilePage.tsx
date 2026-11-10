import { Ellipsis, FileText, Laptop, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { EmptyTable } from '../../components/shared/EmptyTable'
import { MoneyCell } from '../../components/shared/MoneyCell'
import { PageHeader } from '../../components/shared/PageHeader'
import { StatusBadge } from '../../components/shared/StatusBadge'
import {
  Avatar,
  Button,
  buttonVariants,
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
import { formatDate } from '../../lib/format'
import { can } from '../../lib/permissions'
import { useAuthed } from '../../mock/session'
import { useLeaveStore } from '../../mock/stores/leave'
import { usePeopleStore } from '../../mock/stores/people'
import type { Employee } from '../../types'
import { maskAccount, roleLabels, typeLabels } from './helpers'
import {
  AddAssetDialog,
  AddDocumentDialog,
  ChangeStatusDialog,
  docKindLabel,
  EditBankDialog,
  EditEmployeeDialog,
  NewStructureDialog,
} from './ProfileDialogs'

type DialogKind = 'status' | 'edit' | 'structure' | 'bank' | 'document' | 'asset' | null

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

export function ProfilePage() {
  const { id = '' } = useParams()
  const { role } = useAuthed()
  const people = usePeopleStore()
  const [dialog, setDialog] = useState<DialogKind>(null)
  const employee = people.employeeById(id)

  if (!employee) {
    return (
      <div className="mx-auto max-w-content">
        <PageHeader title="Person not found" breadcrumb={[{ label: 'People', to: '/people' }]} />
        <EmptyTable title="No one with this ID" description="The profile may have been removed, or the link is wrong." action={<Link to="/people" className={buttonVariants({ variant: 'secondary' })}>Back to people</Link>} />
      </div>
    )
  }

  const canSeePay = can(role, 'manage_people')
  const close = (o: boolean) => !o && setDialog(null)

  return (
    <div className="mx-auto max-w-content">
      <PageHeader
        title={employee.name}
        breadcrumb={[{ label: 'People', to: '/people' }, { label: employee.name }]}
        actions={
          <>
            <Button onClick={() => setDialog('edit')}>Edit</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton label="More actions"><Ellipsis size={16} /></IconButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setDialog('status')}>Change status</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDialog('edit')}>Edit details</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />
      <div className="mb-4 flex items-center gap-3">
        <Avatar name={employee.name} size="lg" />
        <div className="min-w-0">
          <p className="text-base font-medium">{employee.designation}</p>
          <p className="flex items-center gap-2 text-sm text-fg-muted">
            <span className="font-mono">{employee.code}</span>
            <StatusBadge status={employee.status} />
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="employment">Employment</TabsTrigger>
          {canSeePay && <TabsTrigger value="compensation">Compensation</TabsTrigger>}
          <TabsTrigger value="bank">Bank</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><OverviewTab employee={employee} /></TabsContent>
        <TabsContent value="employment"><EmploymentTab employee={employee} /></TabsContent>
        {canSeePay && <TabsContent value="compensation"><CompensationTab employee={employee} onNew={() => setDialog('structure')} /></TabsContent>}
        <TabsContent value="bank"><BankTab employee={employee} onEdit={() => setDialog('bank')} /></TabsContent>
        <TabsContent value="documents"><DocumentsTab employee={employee} onAdd={() => setDialog('document')} /></TabsContent>
        <TabsContent value="assets"><AssetsTab employee={employee} onAdd={() => setDialog('asset')} /></TabsContent>
        <TabsContent value="attendance">
          <Card><CardBody><p className="text-sm text-fg-muted">Attendance summary</p></CardBody></Card>
        </TabsContent>
        <TabsContent value="leave"><LeaveTab employee={employee} /></TabsContent>
      </Tabs>

      {dialog === 'status' && <ChangeStatusDialog open onOpenChange={close} employee={employee} />}
      {dialog === 'edit' && <EditEmployeeDialog open onOpenChange={close} employee={employee} />}
      {dialog === 'structure' && <NewStructureDialog open onOpenChange={close} employee={employee} />}
      {dialog === 'bank' && <EditBankDialog open onOpenChange={close} employee={employee} />}
      {dialog === 'document' && <AddDocumentDialog open onOpenChange={close} employee={employee} />}
      {dialog === 'asset' && <AddAssetDialog open onOpenChange={close} employee={employee} />}
    </div>
  )
}

function OverviewTab({ employee: e }: { employee: Employee }) {
  const people = usePeopleStore()
  const dept = people.departments.find((d) => d.id === e.department_id)
  const team = people.teamOf(e.id)
  const lead = people.leadOf(e.id)
  const user = people.users.find((u) => u.employee_id === e.id)
  const checklist = people.onboardingChecklists.filter((c) => c.employee_id === e.id)
  const done = checklist.filter((c) => c.done).length
  return (
    <div className="grid gap-4 lg:grid-cols-2">
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
              ['Team lead', lead ? <Link key="l" to={`/people/${lead.id}`} className="text-accent hover:underline">{lead.name}</Link> : 'None'],
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
              <Checkbox key={c.id} checked={c.done} onCheckedChange={() => people.toggleChecklistItem(c.id)} label={c.label} />
            ))}
          </CardBody>
        )}
      </Card>
    </div>
  )
}

function EmploymentTab({ employee: e }: { employee: Employee }) {
  const people = usePeopleStore()
  const events = people.employmentHistory.filter((x) => x.employee_id === e.id).sort((a, b) => b.effective_on.localeCompare(a.effective_on))
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
  const people = usePeopleStore()
  const history = people.salaryHistory(e.id)
  const hourly = e.employment_type === 'contractor'
  const current = people.currentSalary(e.id)
  return (
    <div className="flex flex-col gap-4">
      {current && (
        <div className="grid gap-4 sm:grid-cols-3">
          {hourly ? (
            <Stat label="Hourly rate" value={<MoneyCell amount={current.hourly_rate} className="text-left" />} />
          ) : (
            <>
              <Stat label="Gross per month" value={<MoneyCell amount={current.gross} className="text-left" />} />
              <Stat label="Provident fund" value={`${current.pf_percent}%`} />
              <Stat label="Monthly tax" value={<MoneyCell amount={current.tax_monthly} className="text-left" />} />
            </>
          )}
        </div>
      )}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Salary structures</h2>
        <Button icon={<Plus size={16} />} onClick={onNew}>New structure</Button>
      </div>
      {history.length === 0 ? (
        <EmptyTable title="No salary structure" description="Add the first structure to set pay for this person." action={<Button variant="primary" onClick={onNew}>New structure</Button>} />
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

function BankTab({ employee: e, onEdit }: { employee: Employee; onEdit: () => void }) {
  const bank = usePeopleStore().bankOf(e.id)
  return (
    <Card>
      <CardHeader title="Bank account" actions={<Button onClick={onEdit}>{bank ? 'Edit' : 'Add account'}</Button>} />
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

function DocumentsTab({ employee: e, onAdd }: { employee: Employee; onAdd: () => void }) {
  const docs = usePeopleStore().documents.filter((d) => d.employee_id === e.id)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end"><Button icon={<Plus size={16} />} onClick={onAdd}>Add document</Button></div>
      {docs.length === 0 ? (
        <EmptyTable icon={FileText} title="No documents" description="Upload an ID copy, contract or certificate." />
      ) : (
        <Table>
          <Thead><tr><Th>Name</Th><Th>Kind</Th><Th>Uploaded</Th></tr></Thead>
          <Tbody>
            {docs.map((d) => (
              <Tr key={d.id}><Td>{d.name}</Td><Td>{docKindLabel(d.kind)}</Td><Td className="text-fg-muted">{formatDate(d.uploaded_at)}</Td></Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  )
}

function AssetsTab({ employee: e, onAdd }: { employee: Employee; onAdd: () => void }) {
  const assets = usePeopleStore().assets.filter((a) => a.employee_id === e.id)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end"><Button icon={<Plus size={16} />} onClick={onAdd}>Assign asset</Button></div>
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

function LeaveTab({ employee: e }: { employee: Employee }) {
  const leave = useLeaveStore()
  const year = new Date().getFullYear()
  const balances = leave.balancesFor(e.id, year).filter((b) => b.unlimited || b.entitled > 0 || b.used > 0 || b.pending > 0)
  if (balances.length === 0) return <EmptyTable title="No leave balances" description={`No leave is set up for ${year}.`} />
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {balances.map((b) => (
        <Stat
          key={b.id}
          label={b.type.name}
          value={b.unlimited ? 'Unlimited' : `${b.available} of ${b.entitled}`}
          delta={{ value: `${b.used} used, ${b.pending} pending`, tone: 'neutral' }}
        />
      ))}
    </div>
  )
}
