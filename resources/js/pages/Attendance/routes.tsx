import { page } from '../../app/lazy'
import type { RouteObject } from 'react-router'
import './badges'

const teamRoles = { roles: ['team_lead', 'hr', 'management'] as const }

export const attendanceRoutes: RouteObject[] = [
  { path: 'my-day', element: page(() => import('./MyDayPage'), 'MyDayPage') },
  { path: 'team', handle: { roles: [...teamRoles.roles] }, element: page(() => import('./TeamPage'), 'TeamPage') },
  { path: 'team/history', handle: { roles: [...teamRoles.roles] }, element: page(() => import('./TeamHistoryPage'), 'TeamHistoryPage') },
  { path: 'team/regularizations', handle: { roles: [...teamRoles.roles] }, element: page(() => import('./RegularizationsPage'), 'RegularizationsPage') },
]
