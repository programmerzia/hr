import { createInertiaApp } from '@inertiajs/react'
import { StrictMode, type ComponentType, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { Providers } from './app/providers'
import { AppLayout } from './layouts/AppLayout'
import { AuthLayout } from './layouts/AuthLayout'
import './index.css'
// Mock stores still back the module pages that are not ported yet. Removed in B3 with resources/js/mock.
import './mock/bootstrap'

type Layout = (page: ReactNode) => ReactNode
type PageComponent = ComponentType & { layout?: Layout | null }

const pages = import.meta.glob<Record<string, unknown>>('./pages/**/*.tsx')

const authLayout: Layout = (page) => <AuthLayout>{page}</AuthLayout>
const appLayout: Layout = (page) => <AppLayout>{page}</AppLayout>

/**
 * 'Home/HomePage' → ./pages/Home/HomePage.tsx, default export (or the export named like the file).
 * Layout by path unless the page sets its own `Page.layout`: Auth/* → AuthLayout, everything else → AppLayout
 * (which swaps to the locked shell while auth.user.must_change_password). `Page.layout = null` renders bare.
 */
async function resolve(name: string): Promise<PageComponent> {
  const load = pages[`./pages/${name}.tsx`]
  if (!load) throw new Error(`Inertia page not found: ${name} (expected resources/js/pages/${name}.tsx)`)
  const mod = await load()
  const base = name.split('/').pop() as string
  const Page = (mod.default ?? mod[base]) as PageComponent | undefined
  if (!Page) throw new Error(`resources/js/pages/${name}.tsx has no default export`)
  if (Page.layout === undefined) Page.layout = name.startsWith('Auth/') ? authLayout : appLayout
  return Page
}

void createInertiaApp({
  title: (title) => (title ? `${title} · Vivacom` : 'Vivacom'),
  resolve,
  setup({ el, App, props }) {
    createRoot(el).render(
      <StrictMode>
        <Providers>
          <App {...props} />
        </Providers>
      </StrictMode>,
    )
  },
  progress: { color: 'rgb(var(--accent))', delay: 250 },
})
