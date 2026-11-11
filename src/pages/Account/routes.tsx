import { page } from '../../app/lazy'
import type { RouteObject } from 'react-router'

export const accountRoutes: RouteObject[] = [
  { path: 'account', element: page(() => import('./AccountPage'), 'AccountPage') },
  { path: 'account/password', element: page(() => import('./AccountPage'), 'AccountPage') },
]
