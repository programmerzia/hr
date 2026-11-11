import { page } from '../../app/lazy'
import type { RouteObject } from 'react-router'

export const peopleRoutes: RouteObject[] = [
  {
    path: 'people',
    handle: { roles: ['hr', 'management'] },
    element: page(() => import('./DirectoryPage'), 'DirectoryPage'),
  },
  {
    path: 'people/new',
    handle: { roles: ['hr', 'management'] },
    element: page(() => import('./OnboardPage'), 'OnboardPage'),
  },
  {
    path: 'people/:id',
    handle: { roles: ['hr', 'management'] },
    element: page(() => import('./ProfilePage'), 'ProfilePage'),
  },
]
