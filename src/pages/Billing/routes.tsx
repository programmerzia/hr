import type { RouteObject } from 'react-router'
import { managementOrContractor } from '../../app/guards'
import { BillingPlaceholder } from './Placeholder'

export const billingRoutes: RouteObject[] = [
  {
    path: 'clients',
    handle: { roles: ['management'] },
    element: <BillingPlaceholder title="Clients" />,
  },
  {
    path: 'invoices',
    handle: { roles: ['management'] },
    element: <BillingPlaceholder title="Invoices" />,
  },
  {
    path: 'invoices/:id',
    handle: { roles: ['management'] },
    element: <BillingPlaceholder title="Invoice" />,
  },
  {
    path: 'claims',
    handle: managementOrContractor,
    element: <BillingPlaceholder title="Claims" />,
  },
  {
    path: 'claims/:id',
    handle: managementOrContractor,
    element: <BillingPlaceholder title="Claim" />,
  },
]
