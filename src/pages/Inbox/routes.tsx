import { page } from '../../app/lazy'
import type { RouteObject } from 'react-router'

export const inboxRoutes: RouteObject[] = [{ path: 'inbox', element: page(() => import('./InboxPage'), 'InboxPage') }]
