import type { RouteObject } from 'react-router'
import { AttendancePlaceholder } from './Placeholder'

export const attendanceRoutes: RouteObject[] = [
  {
    path: 'my-day',
    element: <AttendancePlaceholder title="My day" />,
  },
  {
    path: 'team',
    handle: { roles: ['team_lead', 'hr', 'management'] },
    element: <AttendancePlaceholder title="Team" />,
  },
  {
    path: 'team/history',
    handle: { roles: ['team_lead', 'hr', 'management'] },
    element: <AttendancePlaceholder title="Team history" />,
  },
  {
    path: 'team/regularizations',
    handle: { roles: ['team_lead', 'hr', 'management'] },
    element: <AttendancePlaceholder title="Regularizations" />,
  },
]
