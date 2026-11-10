import type { RouteObject } from 'react-router'
import { ApprovalsPage } from './ApprovalsPage'
import { CalendarPage } from './CalendarPage'
import { MyLeavePage } from './MyLeavePage'
import { PolicyPage } from './PolicyPage'

export const leaveRoutes: RouteObject[] = [
  { path: 'leave', element: <MyLeavePage /> },
  {
    path: 'leave/approvals',
    handle: { roles: ['team_lead', 'hr', 'management'] },
    element: <ApprovalsPage />,
  },
  {
    path: 'leave/calendar',
    handle: { roles: ['team_lead', 'hr', 'management'] },
    element: <CalendarPage />,
  },
  {
    path: 'leave/policy',
    handle: { roles: ['hr', 'management'] },
    element: <PolicyPage />,
  },
]
