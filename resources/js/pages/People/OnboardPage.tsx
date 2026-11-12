import { Check } from 'lucide-react'
import { useState } from 'react'
import { router } from '@inertiajs/react'
import { PageHeader } from '../../components/shared/PageHeader'
import { Button, Card, CardBody, CardFooter, Checkbox, Field, Input, NativeSelect } from '../../components/ui'
import { cn } from '../../lib/cn'
import { formatDate, formatMoney } from '../../lib/format'
import { useShared } from '../../inertia/props'
import type { Department, EmploymentType, Role } from '../../types'
import { roleLabels, roleOptions, typeLabels, typeOptions } from './helpers'
import { emptySalaryForm, SalaryFields, toSalaryInput, validateSalary, type SalaryErrors } from './SalaryFields'

const todayIso = () => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

interface Props {
  departments: Department[]
  teams: { id: string; name: string; department_id: string; lead_employee_id: string; lead_name: string | null }[]
  default_checklist: string[]
  existing: { code: string; name: string; email: string }[]
}

/** Which wizard step shows each server-validated field, so a server error can bring the person back to it. */
const stepOf = (key: string): number => {
  if (['name', 'email', 'phone', 'nid'].includes(key)) return 0
  if (['department_id', 'team_id', 'designation', 'employment_type', 'joined_on', 'probation_until'].includes(key)) return 1
  if (key.startsWith('salary.') || key.startsWith('bank.')) return 2
  return 3
}

const steps = ['Identity', 'Employment', 'Compensation', 'Access and checklist'] as const

interface Form {
  name: string
  email: string
  phone: string
  nid: string
  department_id: string
  team_id: string
  designation: string
  employment_type: EmploymentType
  joined_on: string
  probation_until: string
  bank: string
  branch: string
  account_name: string
  account_no: string
  routing_no: string
  role: Role
}

type Errors = Partial<Record<keyof Form, string>> & SalaryErrors

const required = 'Required'

export default function OnboardPage() {
  const { departments, teams, default_checklist: DEFAULT_CHECKLIST, existing } = useShared<Props>()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<Form>({
    name: '', email: '', phone: '', nid: '',
    department_id: departments[0]?.id ?? '', team_id: 'none', designation: '',
    employment_type: 'full_time', joined_on: todayIso(), probation_until: '',
    bank: '', branch: '', account_name: '', account_no: '', routing_no: '',
    role: 'employee',
  })
  const [salary, setSalary] = useState(() => emptySalaryForm(todayIso()))
  const [checklist, setChecklist] = useState<string[]>(DEFAULT_CHECKLIST)
  const [errors, setErrors] = useState<Errors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | undefined>()

  const hourly = form.employment_type === 'contractor'
  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((e) => ({ ...e, [k]: undefined }))
  }
  const text = (k: keyof Form) => ({ value: form[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(k, e.target.value as never) })
  const teamsInDept = teams.filter((t) => t.department_id === form.department_id)

  const validate = (s: number): Errors => {
    const e: Errors = {}
    if (s === 0) {
      if (!form.name.trim()) e.name = required
      if (!form.email.trim()) e.email = required
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email address'
      if (!form.phone.trim()) e.phone = required
      if (!/^\d{10,17}$/.test(form.nid.trim())) e.nid = 'Enter 10 to 17 digits'
    }
    if (s === 1) {
      if (!form.designation.trim()) e.designation = required
      if (!form.joined_on) e.joined_on = required
      if (form.probation_until && form.probation_until <= form.joined_on) e.probation_until = 'Must be after the joining date'
    }
    if (s === 2) {
      Object.assign(e, validateSalary(salary, hourly))
      if (!form.bank.trim()) e.bank = required
      if (!form.branch.trim()) e.branch = required
      if (!form.account_name.trim()) e.account_name = required
      if (!/^\d{6,20}$/.test(form.account_no.trim())) e.account_no = 'Enter 6 to 20 digits'
      if (!/^\d{9}$/.test(form.routing_no.trim())) e.routing_no = 'Enter a 9 digit routing number'
    }
    return e
  }

  const next = () => {
    const e = validate(step)
    setErrors(e)
    if (Object.keys(e).length === 0) setStep(step + 1)
  }

  const create = () => {
    setSubmitting(true)
    setSubmitError(undefined)
    const sal = toSalaryInput({ ...salary, effective_from: salary.effective_from || form.joined_on }, hourly)
    router.post(
      route('people.store'),
      {
        ...form,
        team_id: form.team_id === 'none' ? null : form.team_id,
        probation_until: form.probation_until || null,
        salary: { ...sal },
        bank: { bank: form.bank, branch: form.branch, account_name: form.account_name, account_no: form.account_no, routing_no: form.routing_no },
        checklist,
      },
      {
        onError: (errs) => {
          const mapped: Record<string, string> = {}
          for (const [k, v] of Object.entries(errs)) mapped[k.replace(/^(salary|bank)\./, '')] = v
          setErrors(mapped as Errors)
          const first = Object.keys(errs)[0]
          if (first) setStep(stepOf(first))
          setSubmitError(Object.values(errs)[0])
        },
        onFinish: () => setSubmitting(false),
      },
    )
  }

  const dept = departments.find((d) => d.id === form.department_id)?.name
  const team = teams.find((t) => t.id === form.team_id)
  const lead = team?.lead_name ? { name: team.lead_name } : undefined
  const gross = salary.basic && !hourly ? ['basic', 'house_rent', 'medical', 'conveyance'].reduce((a, k) => a + (Number(salary[k as keyof typeof salary]) || 0), 0) : 0

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Add person" breadcrumb={[{ label: 'People', to: '/people' }, { label: 'Add person' }]} />
      <ol className="mb-4 flex flex-wrap gap-x-6 gap-y-2" aria-label="Steps">
        {steps.map((label, i) => (
          <li key={label} aria-current={i === step ? 'step' : undefined} className={cn('flex items-center gap-2 text-sm', i === step ? 'font-medium text-fg' : 'text-fg-muted')}>
            <span className={cn('flex size-5 items-center justify-center rounded-full text-xs', i < step ? 'bg-success-soft text-success' : i === step ? 'bg-accent text-accent-fg' : 'bg-surface-2')}>
              {i < step ? <Check size={12} /> : i + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>

      <Card>
        <CardBody className="flex flex-col gap-4">
          {step === 0 && (
            <>
              <Field label="Full name" error={errors.name} required><Input {...text('name')} /></Field>
              {(() => {
                const typed = form.name.trim().toLowerCase().replace(/\s+/g, ' ')
                const dup = typed.length >= 3 ? existing.find((e) => e.name.trim().toLowerCase().replace(/\s+/g, ' ') === typed) : undefined
                return dup ? (
                  <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
                    An active employee with this name already exists: {dup.code}, {dup.email}. Only continue if this is a different person.
                  </p>
                ) : null
              })()}
              <Field label="Work email" error={errors.email} hint="Used as the sign-in username." required><Input type="email" {...text('email')} /></Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Phone" error={errors.phone} required><Input {...text('phone')} placeholder="+8801712345678" /></Field>
                <Field label="National ID" error={errors.nid} required><Input {...text('nid')} className="font-mono" /></Field>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Department" required>
                  <NativeSelect value={form.department_id} onChange={(e) => { set('department_id', e.target.value); set('team_id', 'none') }}>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </NativeSelect>
                </Field>
                <Field label="Team">
                  <NativeSelect value={form.team_id} onChange={(e) => set('team_id', e.target.value)}>
                    <option value="none">No team</option>
                    {teamsInDept.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </NativeSelect>
                </Field>
              </div>
              <Field label="Designation" error={errors.designation} required><Input {...text('designation')} /></Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Employment type" required>
                  <NativeSelect value={form.employment_type} onChange={(e) => set('employment_type', e.target.value as EmploymentType)}>
                    {typeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </NativeSelect>
                </Field>
                <Field label="Joining date" error={errors.joined_on} required><Input type="date" {...text('joined_on')} /></Field>
              </div>
              <Field label="Probation until" error={errors.probation_until} hint="Leave empty if there is no probation."><Input type="date" {...text('probation_until')} /></Field>
            </>
          )}

          {step === 2 && (
            <>
              <SalaryFields value={salary} onChange={(f) => { setSalary(f); setErrors((e) => ({ ...e, ...Object.fromEntries(Object.keys(f).map((k) => [k, undefined])) })) }} errors={errors} hourly={hourly} />
              <h3 className="mt-2 text-base font-semibold">Bank account</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Bank" error={errors.bank} required><Input {...text('bank')} /></Field>
                <Field label="Branch" error={errors.branch} required><Input {...text('branch')} /></Field>
                <Field label="Account name" error={errors.account_name} required><Input {...text('account_name')} /></Field>
                <Field label="Account number" error={errors.account_no} required><Input {...text('account_no')} className="font-mono" /></Field>
                <Field label="Routing number" error={errors.routing_no} required><Input {...text('routing_no')} className="font-mono" /></Field>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <Field label="Sign-in role" hint="Decides what this person can see after signing in.">
                <NativeSelect value={form.role} onChange={(e) => set('role', e.target.value as Role)}>
                  {roleOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </NativeSelect>
              </Field>
              <div>
                <h3 className="mb-2 text-base font-semibold">Onboarding checklist</h3>
                <div className="flex flex-col gap-2.5">
                  {DEFAULT_CHECKLIST.map((label) => (
                    <Checkbox
                      key={label}
                      label={label}
                      checked={checklist.includes(label)}
                      onCheckedChange={(v) => setChecklist((c) => (v ? [...c, label] : c.filter((x) => x !== label)))}
                    />
                  ))}
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-base font-semibold">Summary</h3>
                <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-2 rounded-md border border-border bg-surface-2 p-3 text-sm">
                  {([
                    ['Name', form.name],
                    ['Email', form.email],
                    ['Phone', form.phone],
                    ['Department', dept ?? ''],
                    ['Team', team ? `${team.name}${lead ? `, led by ${lead.name}` : ''}` : 'None'],
                    ['Designation', form.designation],
                    ['Type', typeLabels[form.employment_type]],
                    ['Joining date', form.joined_on ? formatDate(form.joined_on) : ''],
                    ['Pay', hourly ? `${formatMoney(Number(salary.hourly_rate) || 0)} per hour` : `${formatMoney(gross)} per month`],
                    ['Bank', `${form.bank}, ${form.branch}`],
                    ['Role', roleLabels[form.role]],
                  ] as [string, string][]).map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-fg-muted">{k}</dt>
                      <dd className="break-words">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              {submitError && <p role="alert" className="text-sm text-danger">{submitError}</p>}
            </>
          )}
        </CardBody>
        <CardFooter className="justify-between">
          <Button variant="ghost" onClick={() => (step === 0 ? router.visit(route('people.directory')) : setStep(step - 1))}>
            {step === 0 ? 'Cancel' : 'Back'}
          </Button>
          {step < steps.length - 1 ? (
            <Button variant="primary" onClick={next}>Continue</Button>
          ) : (
            <Button variant="primary" onClick={create} disabled={submitting}>Create person</Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
