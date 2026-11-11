import { Suspense } from 'react'
import { Outlet } from 'react-router'
import { Logomark } from '../components/shared/Logomark'

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-bg lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside
        data-testid="login-brand"
        className="dot-grid relative hidden flex-col justify-between bg-accent-soft p-12 lg:flex"
      >
        <div className="flex items-center gap-3">
          <Logomark size={40} />
          <span className="text-2xl font-semibold">Vivacom</span>
        </div>
        <p className="text-lg text-fg-muted">Internal workspace</p>
      </aside>
      <div className="flex min-h-screen items-center justify-center px-4 py-8">
        <main className="w-full max-w-sm">
          <div className="mb-6 flex items-center justify-center gap-2 lg:hidden">
            <Logomark size={28} />
            <span className="text-xl font-semibold">Vivacom</span>
          </div>
          <div className="rounded-lg border border-border bg-surface p-6 shadow-xs">
            <Suspense fallback={null}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  )
}
