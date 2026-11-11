import { createBrowserRouter, Navigate } from 'react-router'
import { AppLayout } from '../layouts/AppLayout'
import { AuthLayout } from '../layouts/AuthLayout'
import { accountRoutes } from '../pages/Account/routes'
import { attendanceRoutes } from '../pages/Attendance/routes'
import { authRoutes } from '../pages/Auth/routes'
import { billingRoutes } from '../pages/Billing/routes'
import { chatRoutes } from '../pages/Chat/routes'
import { homeRoutes } from '../pages/Home/routes'
import { inboxRoutes } from '../pages/Inbox/routes'
import { leaveRoutes } from '../pages/Leave/routes'
import { payrollRoutes } from '../pages/Payroll/routes'
import { peopleRoutes } from '../pages/People/routes'
import { settingsRoutes } from '../pages/Settings/routes'
import { workRoutes } from '../pages/Work/routes'
import { RequireAuth, RoleGuard } from './guards'
import { RouteError } from './RouteError'

export const router = createBrowserRouter([
  { element: <AuthLayout />, errorElement: <RouteError />, children: authRoutes },
  {
    element: <RequireAuth />,
    errorElement: <RouteError />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            element: <RoleGuard />,
            children: [
              ...homeRoutes,
              ...attendanceRoutes,
              ...workRoutes,
              ...leaveRoutes,
              ...peopleRoutes,
              ...payrollRoutes,
              ...billingRoutes,
              ...chatRoutes,
              ...inboxRoutes,
              ...settingsRoutes,
              ...accountRoutes,
              { path: '*', element: <Navigate to="/" replace /> },
            ],
          },
        ],
      },
    ],
  },
])

