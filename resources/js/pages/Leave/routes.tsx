import { page } from '../../app/lazy'
import type { RouteObject } from 'react-router'

export const leaveRoutes: RouteObject[] = [
  { path: 'leave', element: page(() => import('./MyLeavePage'), 'MyLeavePage') },
  {
    path: 'leave/approvals',
    handle: { roles: ['team_lead', 'hr', 'management'] },
    element: page(() => import('./ApprovalsPage'), 'ApprovalsPage'),
  },
  {
    path: 'leave/calendar',
    handle: { roles: ['team_lead', 'hr', 'management'] },
    element: page(() => import('./CalendarPage'), 'CalendarPage'),
  },
  {
    path: 'leave/policy',
    handle: { roles: ['hr', 'management'] },
    element: page(() => import('./PolicyPage'), 'PolicyPage'),
  },
]
