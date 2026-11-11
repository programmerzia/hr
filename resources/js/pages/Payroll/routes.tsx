import { page } from '../../app/lazy'
import type { RouteObject } from 'react-router'
import { fullTimeOnly } from '../../app/guards'

export const payrollRoutes: RouteObject[] = [
  { path: 'payroll', handle: { roles: ['hr', 'management'] }, element: page(() => import('./RunsPage'), 'RunsPage') },
  { path: 'payroll/:runId', handle: { roles: ['hr', 'management'] }, element: page(() => import('./RunDetailPage'), 'RunDetailPage') },
  // Owner check happens inside the page; HR and management may open any payslip.
  {
    path: 'payroll/:runId/payslip/:itemId',
    handle: { roles: ['hr', 'management'], allow: fullTimeOnly.allow, bare: true },
    element: page(() => import('./PayslipPage'), 'PayslipPage'),
  },
  { path: 'payslips', handle: fullTimeOnly, element: page(() => import('./MyPayslipsPage'), 'MyPayslipsPage') },
]
