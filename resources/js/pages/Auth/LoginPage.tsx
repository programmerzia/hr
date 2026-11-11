import { useForm } from '@inertiajs/react'
import { useState, type FormEvent } from 'react'
import { ConfirmDialog } from '../../components/shared/ConfirmDialog'
import { Avatar, Badge, Button, Field, Input } from '../../components/ui'
import { useShared } from '../../inertia/props'
import type { Role } from '../../types'

const roleLabel: Record<Role, string> = { employee: 'Employee', team_lead: 'Team lead', hr: 'HR', management: 'Management' }

const DEMO_PASSWORD = 'password'

interface LoginForm {
  email: string
  password: string
  confirm_overtime: boolean
}

export default function LoginPage() {
  const { demo_accounts: demo } = useShared()
  const form = useForm<LoginForm>({ email: '', password: '', confirm_overtime: false })
  const [overtimeAsk, setOvertimeAsk] = useState(false)

  const send = (data: LoginForm) => {
    form.transform(() => data)
    form.post(route('login.store'), {
      onError: (errors) => {
        // The server answers an ended day with this key instead of signing in (docs/06).
        if ('needs_overtime_confirm' in errors) setOvertimeAsk(true)
      },
    })
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    send({ ...form.data, confirm_overtime: false })
  }

  const errors = form.errors as Partial<Record<keyof LoginForm | 'needs_overtime_confirm', string>>
  const credentialsError = errors.email ?? errors.password

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <div>
          <h1 className="text-xl font-semibold">Sign in</h1>
          <p className="mt-0.5 text-sm text-fg-muted">Signing in starts your work clock.</p>
        </div>
        <Field label="Email">
          <Input
            type="email"
            autoComplete="username"
            value={form.data.email}
            onChange={(e) => form.setData('email', e.target.value)}
          />
        </Field>
        <Field label="Password" error={credentialsError}>
          <Input
            type="password"
            autoComplete="current-password"
            value={form.data.password}
            onChange={(e) => form.setData('password', e.target.value)}
          />
        </Field>
        <Button type="submit" variant="primary" className="w-full" disabled={form.processing}>
          Sign in
        </Button>
      </form>

      {demo && demo.length > 0 && (
        <section aria-labelledby="demo-accounts" className="border-t border-border pt-4">
          <h2 id="demo-accounts" className="text-sm font-medium text-fg-muted">
            Demo accounts
          </h2>
          <ul className="mt-2 flex flex-col gap-1">
            {demo.map((a) => (
              <li key={a.email}>
                <button
                  type="button"
                  disabled={form.processing}
                  onClick={() => {
                    form.setData({ email: a.email, password: DEMO_PASSWORD, confirm_overtime: false })
                    send({ email: a.email, password: DEMO_PASSWORD, confirm_overtime: false })
                  }}
                  className="flex h-9 w-full items-center justify-between gap-2 rounded px-2 text-left text-base transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Avatar name={a.name} size="sm" />
                    <span className="truncate">{a.name}</span>
                  </span>
                  <Badge>{a.caption ?? roleLabel[a.role]}</Badge>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-fg-muted">
            Password for all demo accounts: <span className="font-mono">{DEMO_PASSWORD}</span>
          </p>
        </section>
      )}
      <ConfirmDialog
        open={overtimeAsk}
        onOpenChange={setOvertimeAsk}
        title="Start an overtime session?"
        description="You already ended your day. Signing in again records an overtime session."
        confirmLabel="Start overtime"
        onConfirm={() => {
          setOvertimeAsk(false)
          send({ ...form.data, confirm_overtime: true })
        }}
      />
    </div>
  )
}
