import { lazy, type ComponentType, type ReactElement } from 'react'

/**
 * Route element for a page that is loaded on demand: `page(() => import('./FooPage'), 'FooPage')`.
 * The Suspense boundary (with a skeleton fallback) lives in AppLayout and AuthLayout.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function page<P extends object = object>(load: () => Promise<Record<string, any>>, name: string, props?: P): ReactElement {
  const C = lazy(async () => ({ default: (await load())[name] as ComponentType<P> }))
  return <C {...(props as P)} />
}
