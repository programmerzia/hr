import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { Button, Field, Input } from '../../components/ui'
import { employees, users } from '../../mock/db/people'
import { useSession } from '../../mock/session'
import type { Role } from '../../types'

const roleLabel: Record<Role, string> = {
  employee: 'Employee',
  team_lead: 'Team lead',
  hr: 'HR',
  management: 'Management',
}

const demo = [
  { employeeId: 'emp-107', caption: 'Employee' },
  { employeeId: 'emp-103', caption: 'Team lead' },
  { employeeId: 'emp-102', caption: 'HR' },
  { employeeId: 'emp-101', caption: 'Management' },
  { employeeId: 'emp-114', caption: 'Contractor' },
].map((d) => ({ ...d, employee: employees.find((e) => e.id === d.employeeId)! }))

export function LoginPage() {
  const navigate = useNavigate()
  const login = useSession((s) => s.login)
  const signedIn = useSession((s) => s.employee !== null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | undefined>()

  if (signedIn) return <Navigate to="/" replace />

  const enter = (employeeId: string) => {
    if (login(employeeId)) navigate('/', { replace: true })
    else setError('This account cannot sign in.')
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const user = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
    if (!user || !password) {
      setError('Email or password is incorrect.')
      return
    }
    enter(user.employee_id)
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <div>
          <h1 className="text-xl font-semibold">Sign in</h1>
          <p className="mt-0.5 text-sm text-fg-muted">Signing in starts your work clock.</p>
        </div>
        <Field label="Email">
          <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" error={error}>
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Button type="submit" variant="primary" className="w-full">
          Sign in
        </Button>
      </form>

      <section aria-labelledby="demo-accounts" className="border-t border-border pt-4">
        <h2 id="demo-accounts" className="text-sm font-medium text-fg-muted">
          Demo accounts
        </h2>
        <ul className="mt-2 flex flex-col gap-1">
          {demo.map(({ employeeId, caption, employee }) => (
            <li key={employeeId}>
              <button
                type="button"
                onClick={() => enter(employeeId)}
                className="flex h-9 w-full items-center justify-between gap-2 rounded px-2 text-left text-base transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <span className="truncate">{employee.name}</span>
                <span className="text-sm text-fg-muted">
                  {caption === 'Contractor' ? caption : roleLabel[users.find((u) => u.employee_id === employeeId)!.role]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
