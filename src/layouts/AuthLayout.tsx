import { Suspense } from 'react'
import { Outlet } from 'react-router'

export function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-8">
      <main className="w-full max-w-sm">
        <p className="mb-4 text-center text-lg font-semibold">Vivacom</p>
        <div className="rounded-lg border border-border bg-surface p-6">
          <Suspense fallback={null}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
