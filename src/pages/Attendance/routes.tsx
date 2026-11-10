import type { RouteObject } from 'react-router'
import './badges'
import { MyDayPage } from './MyDayPage'
import { RegularizationsPage } from './RegularizationsPage'
import { TeamHistoryPage } from './TeamHistoryPage'
import { TeamPage } from './TeamPage'

const teamRoles = { roles: ['team_lead', 'hr', 'management'] as const }

export const attendanceRoutes: RouteObject[] = [
  { path: 'my-day', element: <MyDayPage /> },
  { path: 'team', handle: { roles: [...teamRoles.roles] }, element: <TeamPage /> },
  { path: 'team/history', handle: { roles: [...teamRoles.roles] }, element: <TeamHistoryPage /> },
  { path: 'team/regularizations', handle: { roles: [...teamRoles.roles] }, element: <RegularizationsPage /> },
]
