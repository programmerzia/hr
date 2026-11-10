import type { RouteObject } from 'react-router'
import { LeavePlaceholder } from './Placeholder'

export const leaveRoutes: RouteObject[] = [
  {
    path: 'leave',
    element: <LeavePlaceholder title="Leave" />,
  },
  {
    path: 'leave/approvals',
    handle: { roles: ['team_lead', 'hr', 'management'] },
    element: <LeavePlaceholder title="Leave approvals" />,
  },
  {
    path: 'leave/calendar',
    handle: { roles: ['team_lead', 'hr', 'management'] },
    element: <LeavePlaceholder title="Leave calendar" />,
  },
]
