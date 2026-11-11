import { Field, Input } from '../../components/ui'
import { formatMoney } from '../../lib/format'
import type { SalaryInput } from '../../mock/stores/people'
import type { SalaryStructure } from '../../types'

export interface SalaryForm {
  effective_from: string
  basic: string
  house_rent: string
  medical: string
  conveyance: string
  pf_percent: string
  tax_monthly: string
  hourly_rate: string
}

export type SalaryErrors = Partial<Record<keyof SalaryForm, string>>

export const emptySalaryForm = (effectiveFrom = ''): SalaryForm => ({
  effective_from: effectiveFrom,
  basic: '',
  house_rent: '',
  medical: '',
  conveyance: '',
  pf_percent: '0',
  tax_monthly: '0',
  hourly_rate: '',
})

export function salaryFormFrom(s: SalaryStructure | undefined, effectiveFrom: string): SalaryForm {
  if (!s) return emptySalaryForm(effectiveFrom)
  return {
    effective_from: effectiveFrom,
    basic: String(s.basic),
    house_rent: String(s.house_rent),
    medical: String(s.medical),
    conveyance: String(s.conveyance),
    pf_percent: String(s.pf_percent),
    tax_monthly: String(s.tax_monthly),
    hourly_rate: String(s.hourly_rate),
  }
}

const num = (v: string) => (v.trim() === '' ? NaN : Number(v))

export function validateSalary(f: SalaryForm, hourly: boolean): SalaryErrors {
  const e: SalaryErrors = {}
  if (!f.effective_from) e.effective_from = 'Choose the effective date'
  if (hourly) {
    if (!(num(f.hourly_rate) > 0)) e.hourly_rate = 'Enter an hourly rate above zero'
    return e
  }
  ;(['basic', 'house_rent', 'medical', 'conveyance', 'tax_monthly'] as const).forEach((k) => {
    if (!(num(f[k]) >= 0)) e[k] = 'Enter an amount, 0 or more'
  })
  if (!(num(f.basic) > 0)) e.basic = 'Basic pay must be above zero'
  const pf = num(f.pf_percent)
  if (!(pf >= 0 && pf <= 100)) e.pf_percent = 'Enter a percentage from 0 to 100'
  return e
}

export function toSalaryInput(f: SalaryForm, hourly: boolean): SalaryInput {
  if (hourly) {
    return { effective_from: f.effective_from, basic: 0, house_rent: 0, medical: 0, conveyance: 0, pf_percent: 0, tax_monthly: 0, hourly_rate: Number(f.hourly_rate) }
  }
  return {
    effective_from: f.effective_from,
    basic: Number(f.basic),
    house_rent: Number(f.house_rent),
    medical: Number(f.medical),
    conveyance: Number(f.conveyance),
    pf_percent: Number(f.pf_percent),
    tax_monthly: Number(f.tax_monthly),
  }
}

interface Props {
  value: SalaryForm
  onChange: (next: SalaryForm) => void
  errors: SalaryErrors
  hourly: boolean
  showDate?: boolean
}

export function SalaryFields({ value, onChange, errors, hourly, showDate = true }: Props) {
  const set = (k: keyof SalaryForm) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [k]: e.target.value })
  const gross = ['basic', 'house_rent', 'medical', 'conveyance'].reduce((a, k) => a + (Number(value[k as keyof SalaryForm]) || 0), 0)
  return (
    <div className="flex flex-col gap-4">
      {showDate && (
        <Field label="Effective from" error={errors.effective_from} required>
          <Input type="date" value={value.effective_from} onChange={set('effective_from')} />
        </Field>
      )}
      {hourly ? (
        <Field label="Hourly rate (BDT)" error={errors.hourly_rate} hint="Contractors are paid by tracked hours." required>
          <Input type="number" min={0} value={value.hourly_rate} onChange={set('hourly_rate')} className="text-right font-mono" />
        </Field>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Basic" error={errors.basic} required><Input type="number" min={0} value={value.basic} onChange={set('basic')} className="text-right font-mono" /></Field>
            <Field label="House rent" error={errors.house_rent} required><Input type="number" min={0} value={value.house_rent} onChange={set('house_rent')} className="text-right font-mono" /></Field>
            <Field label="Medical" error={errors.medical} required><Input type="number" min={0} value={value.medical} onChange={set('medical')} className="text-right font-mono" /></Field>
            <Field label="Conveyance" error={errors.conveyance} required><Input type="number" min={0} value={value.conveyance} onChange={set('conveyance')} className="text-right font-mono" /></Field>
            <Field label="Provident fund (%)" error={errors.pf_percent}><Input type="number" min={0} max={100} value={value.pf_percent} onChange={set('pf_percent')} className="text-right font-mono" /></Field>
            <Field label="Monthly tax" error={errors.tax_monthly}><Input type="number" min={0} value={value.tax_monthly} onChange={set('tax_monthly')} className="text-right font-mono" /></Field>
          </div>
          <p className="text-sm text-fg-muted">
            Gross per month <span className="font-mono font-medium tabular-nums text-fg">{formatMoney(gross)}</span>
          </p>
        </>
      )}
    </div>
  )
}
