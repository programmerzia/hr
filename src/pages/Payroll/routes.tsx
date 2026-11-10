import type { RouteObject } from 'react-router'
import { fullTimeOnly } from '../../app/guards'
import { PayrollPlaceholder } from './Placeholder'

export const payrollRoutes: RouteObject[] = [
  {
    path: 'payroll',
    handle: { roles: ['hr', 'management'] },
    element: <PayrollPlaceholder title="Payroll" />,
  },
  {
    path: 'payroll/:runId',
    handle: { roles: ['hr', 'management'] },
    element: <PayrollPlaceholder title="Payroll run" />,
  },
  {
    path: 'payslips',
    handle: fullTimeOnly,
    element: <PayrollPlaceholder title="Payslips" />,
  },
]
