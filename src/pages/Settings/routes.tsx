import { page } from '../../app/lazy'
import type { RouteObject } from 'react-router'

export const settingsRoutes: RouteObject[] = [
  {
    path: 'settings/*',
    handle: { roles: ['hr', 'management'] },
    element: page(() => import('./Placeholder'), 'SettingsPlaceholder', { title: 'Settings' }),
  },
]
