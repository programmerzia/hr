import type { RouteObject } from 'react-router'
import { fullTimeOnly } from '../../app/guards'
import { MyPayslipsPage } from './MyPayslipsPage'
import { PayslipPage } from './PayslipPage'
import { RunDetailPage } from './RunDetailPage'
import { RunsPage } from './RunsPage'

export const payrollRoutes: RouteObject[] = [
  { path: 'payroll', handle: { roles: ['hr', 'management'] }, element: <RunsPage /> },
  { path: 'payroll/:runId', handle: { roles: ['hr', 'management'] }, element: <RunDetailPage /> },
  // Owner check happens inside the page; HR and management may open any payslip.
  {
    path: 'payroll/:runId/payslip/:itemId',
    handle: { roles: ['hr', 'management'], allow: fullTimeOnly.allow },
    element: <PayslipPage />,
  },
  { path: 'payslips', handle: fullTimeOnly, element: <MyPayslipsPage /> },
]
