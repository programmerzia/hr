import { router, useForm } from '@inertiajs/react'
import { useState } from 'react'
import { Credentials } from '../../components/shared/Credentials'
import { Button, Dialog, Field, Input, NativeSelect } from '../../components/ui'
import { useShared } from '../../inertia/props'
import type { BankAccount, Employee, EmployeeDocumentKind, EmployeeStatus, SalaryStructure, Team } from '../../types'
import { statusOptions } from './helpers'
import {
  SalaryFields,
  salaryFormFrom,
  toSalaryInput,
  validateSalary,
  type SalaryErrors,
} from './SalaryFields'

const todayIso = () => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

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

export function ResetPasswordDialog({ open, onOpenChange, employee }: DialogProps) {
  const { credentials } = useShared<{ credentials: { email: string; temporary_password: string; context: string } | null }>()
  const temp = credentials?.context === 'reset' ? credentials.temporary_password : null
  const [busy, setBusy] = useState(false)
  const reset = () => router.post(route('people.reset-password', employee.id), {}, { preserveScroll: true, onStart: () => setBusy(true), onFinish: () => setBusy(false) })
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Reset password"
      description={employee.name}
      footer={
        temp === null ? (
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button variant="primary" onClick={reset} disabled={busy}>Reset password</Button>
          </>
        ) : (
          <Button variant="primary" onClick={() => onOpenChange(false)}>Done</Button>
        )
      }
    >
      <div className="pb-2">
        {temp === null ? (
          <p className="text-sm text-fg-muted">Issues a new temporary password. The current one stops working immediately.</p>
        ) : (
          <Credentials email={employee.email} password={temp} />
        )}
      </div>
    </Dialog>
  )
}

export function ChangeStatusDialog({ open, onOpenChange, employee }: DialogProps) {
  const form = useForm<{ status: EmployeeStatus; effective_on: string }>({ status: employee.status, effective_on: todayIso() })
  const exiting = form.data.status === 'resigned' || form.data.status === 'terminated'
  const submit = () => form.post(route('people.status', employee.id), { preserveScroll: true, onSuccess: () => onOpenChange(false) })
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Change status"
      description={employee.name}
      footer={<Footer onCancel={() => onOpenChange(false)} onSubmit={submit} label="Save status" disabled={form.processing} />}
    >
      <div className="flex flex-col gap-4 pb-2">
        <Field label="Status" error={form.errors.status}>
          <NativeSelect value={form.data.status} onChange={(e) => { form.setData('status', e.target.value as EmployeeStatus); form.clearErrors() }}>
            {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Effective on" hint={exiting ? 'Sets the exit date and disables sign-in.' : undefined} error={form.errors.effective_on}>
          <Input type="date" value={form.data.effective_on} onChange={(e) => form.setData('effective_on', e.target.value)} />
        </Field>
      </div>
    </Dialog>
  )
}

export function EditEmployeeDialog({ open, onOpenChange, employee }: DialogProps) {
  const { teams } = useShared<{ teams?: Team[] }>()
  const form = useForm({
    name: employee.name,
    designation: employee.designation,
    email: employee.email,
    phone: employee.phone,
    team_id: employee.team_id ?? 'none',
  })
  const submit = () => {
    form.transform((d) => ({ ...d, team_id: d.team_id === 'none' ? null : d.team_id }))
    form.patch(route('people.update', employee.id), { preserveScroll: true, onSuccess: () => onOpenChange(false) })
  }
  const bind = (k: 'name' | 'designation' | 'email' | 'phone') => ({ value: form.data[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => form.setData(k, e.target.value) })
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit details"
      description={employee.code}
      footer={<Footer onCancel={() => onOpenChange(false)} onSubmit={submit} label="Save changes" disabled={form.processing} />}
    >
      <div className="flex flex-col gap-4 pb-2">
        <Field label="Full name" error={form.errors.name} required><Input {...bind('name')} /></Field>
        <Field label="Designation" error={form.errors.designation} required><Input {...bind('designation')} /></Field>
        <Field label="Email" error={form.errors.email} required><Input type="email" {...bind('email')} /></Field>
        <Field label="Phone" error={form.errors.phone}><Input {...bind('phone')} /></Field>
        <Field label="Team" error={form.errors.team_id}>
          <NativeSelect value={form.data.team_id} onChange={(e) => form.setData('team_id', e.target.value)}>
            <option value="none">No team</option>
            {(teams ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </NativeSelect>
        </Field>
      </div>
    </Dialog>
  )
}

export function NewStructureDialog({ open, onOpenChange, employee, current }: DialogProps & { current: SalaryStructure | undefined }) {
  const hourly = employee.employment_type === 'contractor'
  const form = useForm(salaryFormFrom(current, todayIso()))
  const [errors, setErrors] = useState<SalaryErrors>({})
  const submit = () => {
    const errs = validateSalary(form.data, hourly)
    setErrors(errs)
    if (Object.keys(errs).length) return
    form.transform((d) => ({ ...toSalaryInput(d, hourly) }))
    form.post(route('people.salary', employee.id), { preserveScroll: true, onSuccess: () => onOpenChange(false) })
  }
  const shown: SalaryErrors = { ...errors, ...(form.errors as SalaryErrors) }
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="New salary structure"
      description="Structures are never edited. A new one takes over from its effective date."
      footer={<Footer onCancel={() => onOpenChange(false)} onSubmit={submit} label="Add structure" disabled={form.processing} />}
    >
      <div className="pb-2">
        <SalaryFields value={form.data} onChange={(f) => { form.setData(f); form.clearErrors() }} errors={shown} hourly={hourly} />
      </div>
    </Dialog>
  )
}

export function EditBankDialog({ open, onOpenChange, employee, bank }: DialogProps & { bank: BankAccount | null }) {
  const form = useForm({
    bank: bank?.bank ?? '',
    account_name: bank?.account_name ?? employee.name,
    account_no: bank?.account_no ?? '',
    routing_no: bank?.routing_no ?? '',
    branch: bank?.branch ?? '',
  })
  const [touched, setTouched] = useState(false)
  const set = (k: keyof typeof form.data) => (e: React.ChangeEvent<HTMLInputElement>) => form.setData(k, e.target.value)
  const missing = (k: keyof typeof form.data) => form.errors[k] ?? (touched && !form.data[k].trim() ? 'Required' : undefined)
  const submit = () => {
    setTouched(true)
    if (Object.values(form.data).some((v) => !v.trim())) return
    form.post(route('people.bank', employee.id), { preserveScroll: true, onSuccess: () => onOpenChange(false) })
  }
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit bank account"
      description="Salary and claims are paid to this account."
      footer={<Footer onCancel={() => onOpenChange(false)} onSubmit={submit} label="Save account" disabled={form.processing || Object.values(form.data).some((v) => !v.trim())} />}
    >
      <div className="flex flex-col gap-4 pb-2">
        <Field label="Bank" error={missing('bank')} required><Input value={form.data.bank} onChange={set('bank')} /></Field>
        <Field label="Branch" error={missing('branch')} required><Input value={form.data.branch} onChange={set('branch')} /></Field>
        <Field label="Account name" error={missing('account_name')} required><Input value={form.data.account_name} onChange={set('account_name')} /></Field>
        <Field label="Account number" error={missing('account_no')} required><Input value={form.data.account_no} onChange={set('account_no')} className="font-mono" /></Field>
        <Field label="Routing number" error={missing('routing_no')} required><Input value={form.data.routing_no} onChange={set('routing_no')} className="font-mono" /></Field>
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
  const form = useForm<{ kind: EmployeeDocumentKind; file: File | null }>({ kind: 'other', file: null })
  const submit = () => form.post(route('people.documents', employee.id), { preserveScroll: true, forceFormData: true, onSuccess: () => onOpenChange(false) })
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add document"
      description={employee.name}
      footer={<Footer onCancel={() => onOpenChange(false)} onSubmit={submit} label="Add document" disabled={form.processing || !form.data.file} />}
    >
      <div className="flex flex-col gap-4 pb-2">
        <Field label="Kind" error={form.errors.kind}>
          <NativeSelect value={form.data.kind} onChange={(e) => form.setData('kind', e.target.value as EmployeeDocumentKind)}>
            {docKinds.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </NativeSelect>
        </Field>
        <Field label="File" error={form.errors.file} required>
          <Input type="file" onChange={(e) => form.setData('file', e.target.files?.[0] ?? null)} />
        </Field>
      </div>
    </Dialog>
  )
}

export function AddAssetDialog({ open, onOpenChange, employee }: DialogProps) {
  const form = useForm({ name: '', tag: '', assigned_on: todayIso() })
  const submit = () => form.post(route('people.assets', employee.id), { preserveScroll: true, onSuccess: () => onOpenChange(false) })
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Assign asset"
      description={employee.name}
      footer={<Footer onCancel={() => onOpenChange(false)} onSubmit={submit} label="Assign asset" disabled={form.processing || !form.data.name.trim() || !form.data.tag.trim()} />}
    >
      <div className="flex flex-col gap-4 pb-2">
        <Field label="Asset" error={form.errors.name} required><Input value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} placeholder="Dell monitor 24 inch" /></Field>
        <Field label="Asset tag" error={form.errors.tag} required><Input value={form.data.tag} onChange={(e) => form.setData('tag', e.target.value)} className="font-mono" placeholder="MN-0042" /></Field>
        <Field label="Assigned on" error={form.errors.assigned_on}><Input type="date" value={form.data.assigned_on} onChange={(e) => form.setData('assigned_on', e.target.value)} /></Field>
      </div>
    </Dialog>
  )
}
