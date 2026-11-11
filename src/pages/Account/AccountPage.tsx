import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { PageHeader } from '../../components/shared/PageHeader'
import { Button, Card, CardBody, CardFooter, CardHeader, Field, Input } from '../../components/ui'
import { formatDate } from '../../lib/format'
import { useAuthed, useSession } from '../../mock/session'
import { MIN_PASSWORD, usePeopleStore } from '../../mock/stores/people'
import { roleLabels, typeLabels } from '../People/helpers'

export function AccountPage() {
  const { user, employee, role } = useAuthed()
  const people = usePeopleStore()
  const navigate = useNavigate()
  const forced = people.users.find((u) => u.id === user.id)?.must_change_password ?? false
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string }>({})
  const [saved, setSaved] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setSaved(false)
    if (next !== confirm) return setErrors({ confirm: 'Passwords do not match' })
    const res = people.changePassword(user.id, current, next)
    if (!res.ok) {
      const field = res.error.startsWith('Current') ? 'current' : 'next'
      return setErrors({ [field]: res.error })
    }
    useSession.setState({ user: res.value })
    setErrors({})
    setCurrent('')
    setNext('')
    setConfirm('')
    if (forced) navigate('/', { replace: true })
    else setSaved(true)
  }

  const team = people.teamOf(employee.id)
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
              <Field label="Current password" error={errors.current}>
                <Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
              </Field>
              <Field label="New password" hint={`At least ${MIN_PASSWORD} characters.`} error={errors.next}>
                <Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
              </Field>
              <Field label="Confirm new password" error={errors.confirm}>
                <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </Field>
              {saved && <p role="status" className="text-sm text-success">Password changed.</p>}
            </CardBody>
            <CardFooter className="justify-end">
              <Button type="submit" variant="primary">Change password</Button>
            </CardFooter>
          </Card>
        </form>
      </div>
    </div>
  )
}
