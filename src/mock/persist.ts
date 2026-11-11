// Local persistence for the mock stores (localStorage, key `vivacom.v1.<store>`).
//
// Merge rule, applied synchronously when a store module is first imported (before bootstrap runs):
//   Seeds are regenerated on every load (attendance seed is relative to "today"), then the stored snapshot is merged in.
//   (a) Arrays merge by `id`: a snapshot row replaces the seed row with the same id (user edits win), snapshot-only
//       rows are appended (user-created rows survive).
//   (b) Seed rows missing from the snapshot are kept, so a new day's fresh seed still appears.
//   (c) Per-store hooks may adjust this; attendance drops seed days (and their segments) for any employee+date that
//       already exists in the snapshot, so the snapshot's day wins even if its id differs.
//   Records (plain objects) merge key-wise, snapshot over seed. Scalars and functions are never stored.
//   A snapshot written with a different SEED_VERSION is discarded. Deleted seed rows reappear (acceptable for a demo).
import type { StoreApi, UseBoundStore } from 'zustand'

export const SEED_VERSION = 1
export const PERSIST_PREFIX = 'vivacom.v1.'

interface Snapshot {
  version: number
  data: Record<string, unknown>
}

let resetting = false

type WithId = { id: string }

export function mergeById<T extends WithId>(seed: T[], snapshot: T[]): T[] {
  const snapIds = new Set(snapshot.map((r) => r.id))
  return [...seed.filter((r) => !snapIds.has(r.id)), ...snapshot]
}

function mergeValue(seed: unknown, snap: unknown): unknown {
  if (Array.isArray(seed) && Array.isArray(snap)) {
    const idRows = (a: unknown[]) => a.every((r) => !!r && typeof r === 'object' && typeof (r as WithId).id === 'string')
    return idRows(seed) && idRows(snap) ? mergeById(seed as WithId[], snap as WithId[]) : snap
  }
  if (seed && snap && typeof seed === 'object' && typeof snap === 'object') return { ...seed, ...snap }
  return snap === undefined ? seed : snap
}

function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export interface PersistOptions<S> {
  /** Adjust the seed against the raw snapshot before the generic merge (e.g. drop superseded seed rows). */
  prepareSeed?: (seed: Pick<S, keyof S>, snapshot: Partial<S>) => Partial<S>
}

/** Hydrate a store synchronously from localStorage and keep its data keys saved on every change. */
export function persistStore<S extends object, K extends keyof S>(
  store: UseBoundStore<StoreApi<S>>,
  name: string,
  keys: K[],
  opts: PersistOptions<S> = {},
): void {
  const ls = storage()
  if (!ls) return
  const key = PERSIST_PREFIX + name
  try {
    const raw = ls.getItem(key)
    const parsed = raw ? (JSON.parse(raw) as Snapshot) : null
    if (parsed && parsed.version === SEED_VERSION && parsed.data) {
      const snap = parsed.data as Partial<S>
      const state = store.getState()
      const seed = { ...state, ...(opts.prepareSeed?.(state, snap) ?? {}) } as S
      const next: Partial<S> = {}
      for (const k of keys) if (k in snap) next[k] = mergeValue(seed[k], snap[k]) as S[K]
      store.setState(next)
    } else if (parsed) {
      ls.removeItem(key)
    }
  } catch {
    ls.removeItem(key)
  }

  let pending = false
  const write = () => {
    pending = false
    if (resetting) return
    const s = store.getState()
    const data: Record<string, unknown> = {}
    for (const k of keys) data[k as string] = s[k]
    try {
      ls.setItem(key, JSON.stringify({ version: SEED_VERSION, data } satisfies Snapshot))
    } catch {
      // quota or private mode: keep running in memory
    }
  }
  let prev = keys.map((k) => store.getState()[k])
  store.subscribe((s) => {
    const cur = keys.map((k) => s[k])
    if (cur.every((v, i) => v === prev[i])) return
    prev = cur
    if (!pending) {
      pending = true
      queueMicrotask(write)
    }
  })
  write()
}

/** Clear every persisted store and reload into fresh seed data. */
export function resetAllPersisted(): void {
  resetting = true
  const ls = storage()
  if (ls) {
    for (const k of Object.keys(ls)) if (k.startsWith(PERSIST_PREFIX)) ls.removeItem(k)
    ls.removeItem('vivacom.last_heartbeat') // a stale heartbeat would reopen work on the fresh seed
  }
  window.location.reload()
}
