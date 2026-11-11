import { useForm } from '@inertiajs/react'
import { useState, type FormEvent } from 'react'
import { PageHeader } from '../../components/shared/PageHeader'
import { Button, Card, CardBody, CardFooter, CardHeader, Field, Input } from '../../components/ui'
import { useAuth, useShared } from '../../inertia/props'
import { formatDate } from '../../lib/format'
import { roleLabels, typeLabels } from '../People/helpers'

const MIN_PASSWORD = 8

interface AccountProps {
  /** Team the viewer belongs to, when any. */
  team?: { name: string } | null
}

export default function AccountPage() {
  const { user, employee, role } = useAuth()
  const { team } = useShared<AccountProps>()
  const forced = user.must_change_password
  const [saved, setSaved] = useState(false)
  const form = useForm({ current: '', next: '', next_confirmation: '' })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setSaved(false)
    // On a forced change the server redirects home; otherwise it returns here.
    form.clearErrors()
    if (form.data.next !== form.data.next_confirmation) {
      form.setError('next_confirmation', 'Passwords do not match')
      return
    }
    form.transform(({ current, next }) => ({ current, next }))
    form.post(route('account.password.update'), {
      preserveScroll: true,
      onSuccess: () => {
        form.reset()
        setSaved(true)
      },
    })
  }

  const rows: [string, string][] = [
    ['Name', employee.name],
    ['Email', employee.email],
    ['Role', roleLabels[role]],
    ['Designation', employee.designation],
    ['Team', team?.name ?? 'None'],
    ['Type', typeLabels[employee.employment_type]],
    ['Joined', formatDate(employee.joined_on)],
  ]

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Account" />
      {forced && (
        <p role="status" className="mb-4 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm">
          Set a new password to continue. Your temporary password only works once.
        </p>
      )}
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold">Profile</h2>
          </CardHeader>
          <CardBody>
            <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-2.5 text-sm">
              {rows.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-fg-muted">{k}</dt>
                  <dd className="min-w-0 break-words">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-fg-muted">To change these details, ask HR.</p>
          </CardBody>
        </Card>

        <form onSubmit={submit} noValidate>
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold">Password</h2>
            </CardHeader>
            <CardBody className="flex max-w-sm flex-col gap-4">
              <Field label="Current password" error={form.errors.current}>
                <Input type="password" autoComplete="current-password" value={form.data.current} onChange={(e) => form.setData('current', e.target.value)} />
              </Field>
              <Field label="New password" hint={`At least ${MIN_PASSWORD} characters.`} error={form.errors.next}>
                <Input type="password" autoComplete="new-password" value={form.data.next} onChange={(e) => form.setData('next', e.target.value)} />
              </Field>
              <Field label="Confirm new password" error={form.errors.next_confirmation}>
                <Input type="password" autoComplete="new-password" value={form.data.next_confirmation} onChange={(e) => form.setData('next_confirmation', e.target.value)} />
              </Field>
              {saved && <p role="status" className="text-sm text-success">Password changed.</p>}
            </CardBody>
            <CardFooter className="justify-end">
              <Button type="submit" variant="primary" disabled={form.processing}>Change password</Button>
            </CardFooter>
          </Card>
        </form>
      </div>
    </div>
  )
}
