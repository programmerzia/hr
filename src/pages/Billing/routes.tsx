import type { RouteObject } from 'react-router'
import type { RouteHandle } from '../../app/guards'
import { ClaimDetailPage } from './ClaimDetailPage'
import { ClaimsPage } from './ClaimsPage'
import { ClientsPage } from './ClientsPage'
import { InvoiceDetailPage } from './InvoiceDetailPage'
import { InvoiceEditorPage } from './InvoiceEditorPage'
import { InvoicesPage } from './InvoicesPage'

/** Claims are open to management, team leads (to verify hours) and contractors (their own). */
const claimsAccess: RouteHandle = {
  roles: ['management', 'team_lead'],
  allow: ({ employee }) => employee.employment_type === 'contractor',
}

const managementOnly: RouteHandle = { roles: ['management'] }

export const billingRoutes: RouteObject[] = [
  { path: 'clients', handle: managementOnly, element: <ClientsPage /> },
  { path: 'invoices', handle: managementOnly, element: <InvoicesPage /> },
  { path: 'invoices/new', handle: managementOnly, element: <InvoiceEditorPage /> },
  { path: 'invoices/:id', handle: managementOnly, element: <InvoiceDetailPage /> },
  { path: 'invoices/:id/edit', handle: managementOnly, element: <InvoiceEditorPage /> },
  { path: 'claims', handle: claimsAccess, element: <ClaimsPage /> },
  { path: 'claims/:id', handle: claimsAccess, element: <ClaimDetailPage /> },
]
