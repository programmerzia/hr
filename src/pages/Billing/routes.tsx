import { page } from '../../app/lazy'
import type { RouteObject } from 'react-router'
import type { RouteHandle } from '../../app/guards'

/** Claims are open to management, team leads (to verify hours) and contractors (their own). */
const claimsAccess: RouteHandle = {
  roles: ['management', 'team_lead'],
  allow: ({ employee }) => employee.employment_type === 'contractor',
}

const managementOnly: RouteHandle = { roles: ['management'] }

export const billingRoutes: RouteObject[] = [
  { path: 'clients', handle: managementOnly, element: page(() => import('./ClientsPage'), 'ClientsPage') },
  { path: 'invoices', handle: managementOnly, element: page(() => import('./InvoicesPage'), 'InvoicesPage') },
  { path: 'invoices/new', handle: managementOnly, element: page(() => import('./InvoiceEditorPage'), 'InvoiceEditorPage') },
  { path: 'invoices/:id', handle: managementOnly, element: page(() => import('./InvoiceDetailPage'), 'InvoiceDetailPage') },
  { path: 'invoices/:id/print', handle: { ...managementOnly, bare: true }, element: page(() => import('./InvoiceDetailPage'), 'InvoiceDetailPage', { printView: true }) },
  { path: 'invoices/:id/edit', handle: managementOnly, element: page(() => import('./InvoiceEditorPage'), 'InvoiceEditorPage') },
  { path: 'claims', handle: claimsAccess, element: page(() => import('./ClaimsPage'), 'ClaimsPage') },
  { path: 'claims/:id', handle: claimsAccess, element: page(() => import('./ClaimDetailPage'), 'ClaimDetailPage') },
]
