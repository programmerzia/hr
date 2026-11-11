import { useEffect } from 'react'
import { create } from 'zustand'

export interface Crumb {
  label: string
  to?: string
}

interface PageTitleState {
  /** Crumbs the current page published; null = the top bar falls back to the nav item label. */
  crumbs: Crumb[] | null
  setBreadcrumb: (crumbs: (string | Crumb)[] | null) => void
}

/** Tiny store so a page can name its record in the top bar: `setBreadcrumb(['Payroll', 'November 2026'])`. */
export const usePageTitle = create<PageTitleState>((set) => ({
  crumbs: null,
  setBreadcrumb: (crumbs) =>
    set({ crumbs: crumbs ? crumbs.map((c) => (typeof c === 'string' ? { label: c } : c)) : null }),
}))

/** Publishes crumbs while the calling page is mounted. PageHeader calls this for its `breadcrumb` prop. */
export function useBreadcrumb(crumbs: (string | Crumb)[] | undefined) {
  const setBreadcrumb = usePageTitle((s) => s.setBreadcrumb)
  const key = crumbs ? JSON.stringify(crumbs) : ''
  useEffect(() => {
    if (!key) return
    setBreadcrumb(JSON.parse(key) as (string | Crumb)[])
    return () => setBreadcrumb(null)
  }, [key, setBreadcrumb])
}
