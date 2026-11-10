import type { RouteObject } from 'react-router'
import { SettingsPlaceholder } from './Placeholder'

export const settingsRoutes: RouteObject[] = [
  {
    path: 'settings/*',
    handle: { roles: ['hr', 'management'] },
    element: <SettingsPlaceholder title="Settings" />,
  },
]
