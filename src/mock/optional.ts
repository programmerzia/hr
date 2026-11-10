import { useEffect, useState } from 'react'

// Payroll and Billing stores are built by other modules. They are picked up with a glob so this code
// compiles and runs whether or not they exist; consumers render nothing for an absent module.
declare global {
  interface ImportMeta {
    glob(pattern: string): Record<string, () => Promise<unknown>>
  }
}

export type OptionalModule = 'payroll' | 'billing'

interface AnyStore {
  getState: () => Record<string, unknown>
  subscribe: (fn: () => void) => () => void
}

const loaders = import.meta.glob('./stores/{payroll,billing}.ts')
const cache = new Map<OptionalModule, Promise<AnyStore | null>>()

function isStore(value: unknown): value is AnyStore {
  return typeof value === 'function' && 'getState' in value && 'subscribe' in value
}

function load(name: OptionalModule): Promise<AnyStore | null> {
  const hit = cache.get(name)
  if (hit) return hit
  const loader = loaders[`./stores/${name}.ts`]
  const promise = loader
    ? loader()
        .then((mod) => Object.values(mod as Record<string, unknown>).find(isStore) ?? null)
        .catch(() => null)
    : Promise.resolve(null)
  cache.set(name, promise)
  return promise
}

/** Live state snapshot of an optional module's store, or null while loading or when it does not exist. */
export function useOptionalState(name: OptionalModule): Record<string, unknown> | null {
  const [state, setState] = useState<Record<string, unknown> | null>(null)
  useEffect(() => {
    let off: (() => void) | undefined
    let alive = true
    void load(name).then((store) => {
      if (!store || !alive) return
      setState(store.getState())
      off = store.subscribe(() => setState(store.getState()))
    })
    return () => {
      alive = false
      off?.()
    }
  }, [name])
  return state
}

/** Read an array field from optional state, or null when missing. */
export function listOf<T>(state: Record<string, unknown> | null, field: string): T[] | null {
  const v = state?.[field]
  return Array.isArray(v) ? (v as T[]) : null
}
