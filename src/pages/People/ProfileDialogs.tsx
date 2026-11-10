import { useState } from 'react'
import { Button, Dialog, Field, Input, NativeSelect } from '../../components/ui'
import { todayIso, usePeopleStore } from '../../mock/stores/people'
import type { Employee, EmployeeDocumentKind, EmployeeStatus } from '../../types'
import { statusOptions } from './helpers'
import {
  SalaryFields,
  salaryFormFrom,
  toSalaryInput,
  validateSalary,
  type SalaryErrors,
} from './SalaryFields'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee: Employee
}

function Footer({ onCancel, onSubmit, label, disabled }: { onCancel: () => void; onSubmit: () => void; label: string; disabled?: boolean }) {
  return (
    <>
      <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      <Button variant="primary" onClick={onSubmit} disabled={disabled}>{label}</Button>
    </>
  )
}

export function ChangeStatusDialog({ open, onOpenChange, employee }: DialogProps) {
  const people = usePeopleStore()
  const [status, setStatus] = useState<EmployeeStatus>(employee.status)
  const [on, setOn] = useState(todayIso())
  const [error, setError] = useState<string | undefined>()
  const exiting = status === 'resigned' || status === 'terminated'
  const submit = () => {
    const res = people.changeStatus(employee.id, status, on)
    if (!res.ok) return setError(res.error)
    setError(undefined)
    onOpenChange(false)
  }
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Change status"
      description={employee.name}
      footer={<Footer onCancel={() => onOpenChange(false)} onSubmit={submit} label="Save status" />}
    >
      <div className="flex flex-col gap-4 pb-2">
        <Field label="Status">
          <NativeSelect value={status} onChange={(e) => { setStatus(e.target.value as EmployeeStatus); setError(undefined) }}>
            {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Effective on" hint={exiting ? 'Sets the exit date and disables sign-in.' : undefined} error={error}>
          <Input type="date" value={on} onChange={(e) => setOn(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  )
}

export function EditEmployeeDialog({ open, onOpenChange, employee }: DialogProps) {
  const people = usePeopleStore()
  const [name, setName] = useState(employee.name)
  const [designation, setDesignation] = useState(employee.designation)
  const [phone, setPhone] = useState(employee.phone)
  const [email, setEmail] = useState(employee.email)
  const [teamId, setTeamId] = useState(employee.team_id ?? 'none')
  const [touched, setTouched] = useState(false)
  const missing = (v: string) => (touched && !v.trim() ? 'Required' : undefined)
  const submit = () => {
    setTouched(true)
    if (!name.trim() || !designation.trim() || !email.trim()) return
    const team = people.teams.find((t) => t.id === teamId)
    people.updateEmployee(employee.id, {
      name: name.trim(),
      designation: designation.trim(),
      phone: phone.trim(),
      email: email.trim(),
      team_id: team?.id ?? null,
      department_id: team?.department_id ?? employee.department_id,
    })
    onOpenChange(false)
  }
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit details"
      description={employee.code}
      footer={<Footer onCancel={() => onOpenChange(false)} onSubmit={submit} label="Save changes" />}
    >
      <div className="flex flex-col gap-4 pb-2">
        <Field label="Full name" error={missing(name)} required><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Designation" error={missing(designation)} required><Input value={designation} onChange={(e) => setDesignation(e.target.value)} /></Field>
        <Field label="Email" error={missing(email)} required><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Phone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        <Field label="Team">
          <NativeSelect value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            <option value="none">No team</option>
            {people.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </NativeSelect>
        </Field>
      </div>
    </Dialog>
  )
}

export function NewStructureDialog({ open, onOpenChange, employee }: DialogProps) {
  const people = usePeopleStore()
  const hourly = employee.employment_type === 'contractor'
  const [form, setForm] = useState(() => salaryFormFrom(people.currentSalary(employee.id), todayIso()))
  const [errors, setErrors] = useState<SalaryErrors>({})
  const [error, setError] = useState<string | undefined>()
  const submit = () => {
    const errs = validateSalary(form, hourly)
    setErrors(errs)
    if (Object.keys(errs).length) return
    const res = people.addSalaryStructure(employee.id, toSalaryInput(form, hourly))
    if (!res.ok) return setError(res.error)
    onOpenChange(false)
  }
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="New salary structure"
      description="Structures are never edited. A new one takes over from its effective date."
      footer={<Footer onCancel={() => onOpenChange(false)} onSubmit={submit} label="Add structure" />}
    >
      <div className="pb-2">
        <SalaryFields value={form} onChange={(f) => { setForm(f); setError(undefined) }} errors={error ? { ...errors, effective_from: error } : errors} hourly={hourly} />
      </div>
    </Dialog>
  )
}

export function EditBankDialog({ open, onOpenChange, employee }: DialogProps) {
  const people = usePeopleStore()
  const bank = people.bankOf(employee.id)
  const [f, setF] = useState({
    bank: bank?.bank ?? '',
    account_name: bank?.account_name ?? employee.name,
    account_no: bank?.account_no ?? '',
    routing_no: bank?.routing_no ?? '',
    branch: bank?.branch ?? '',
  })
  const [touched, setTouched] = useState(false)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  const missing = (v: string) => (touched && !v.trim() ? 'Required' : undefined)
  const submit = () => {
    setTouched(true)
    if (Object.values(f).some((v) => !v.trim())) return
    people.updateBankAccount(employee.id, f)
    onOpenChange(false)
  }
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit bank account"
      description="Salary and claims are paid to this account."
      footer={<Footer onCancel={() => onOpenChange(false)} onSubmit={submit} label="Save account" disabled={Object.values(f).some((v) => !v.trim())} />}
    >
      <div className="flex flex-col gap-4 pb-2">
        <Field label="Bank" error={missing(f.bank)} required><Input value={f.bank} onChange={set('bank')} /></Field>
        <Field label="Branch" error={missing(f.branch)} required><Input value={f.branch} onChange={set('branch')} /></Field>
        <Field label="Account name" error={missing(f.account_name)} required><Input value={f.account_name} onChange={set('account_name')} /></Field>
        <Field label="Account number" error={missing(f.account_no)} required><Input value={f.account_no} onChange={set('account_no')} className="font-mono" /></Field>
        <Field label="Routing number" error={missing(f.routing_no)} required><Input value={f.routing_no} onChange={set('routing_no')} className="font-mono" /></Field>
      </div>
    </Dialog>
  )
}

const docKinds: { value: EmployeeDocumentKind; label: string }[] = [
  { value: 'nid', label: 'National ID' },
  { value: 'contract', label: 'Contract' },
  { value: 'cv', label: 'CV' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'other', label: 'Other' },
]
export const docKindLabel = (k: EmployeeDocumentKind) => docKinds.find((d) => d.value === k)?.label ?? k

export function AddDocumentDialog({ open, onOpenChange, employee }: DialogProps) {
  const people = usePeopleStore()
  const [kind, setKind] = useState<EmployeeDocumentKind>('other')
  const [name, setName] = useState('')
  const [touched, setTouched] = useState(false)
  const submit = () => {
    setTouched(true)
    if (!name.trim()) return
    people.addDocument(employee.id, { kind, name: name.trim() })
    setName('')
    setTouched(false)
    onOpenChange(false)
  }
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add document"
      description={employee.name}
      footer={<Footer onCancel={() => onOpenChange(false)} onSubmit={submit} label="Add document" disabled={!name.trim()} />}
    >
      <div className="flex flex-col gap-4 pb-2">
        <Field label="Kind">
          <NativeSelect value={kind} onChange={(e) => setKind(e.target.value as EmployeeDocumentKind)}>
            {docKinds.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </NativeSelect>
        </Field>
        <Field label="File name" error={touched && !name.trim() ? 'Enter a file name' : undefined} required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Offer letter.pdf" />
        </Field>
      </div>
    </Dialog>
  )
}

export function AddAssetDialog({ open, onOpenChange, employee }: DialogProps) {
  const people = usePeopleStore()
  const [name, setName] = useState('')
  const [tag, setTag] = useState('')
  const [on, setOn] = useState(todayIso())
  const [touched, setTouched] = useState(false)
  const submit = () => {
    setTouched(true)
    if (!name.trim() || !tag.trim()) return
    people.addAsset(employee.id, { name: name.trim(), tag: tag.trim(), assigned_on: on })
    setName('')
    setTag('')
    setTouched(false)
    onOpenChange(false)
  }
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Assign asset"
      description={employee.name}
      footer={<Footer onCancel={() => onOpenChange(false)} onSubmit={submit} label="Assign asset" disabled={!name.trim() || !tag.trim()} />}
    >
      <div className="flex flex-col gap-4 pb-2">
        <Field label="Asset" error={touched && !name.trim() ? 'Required' : undefined} required><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dell monitor 24 inch" /></Field>
        <Field label="Asset tag" error={touched && !tag.trim() ? 'Required' : undefined} required><Input value={tag} onChange={(e) => setTag(e.target.value)} className="font-mono" placeholder="MN-0042" /></Field>
        <Field label="Assigned on"><Input type="date" value={on} onChange={(e) => setOn(e.target.value)} /></Field>
      </div>
    </Dialog>
  )
}
