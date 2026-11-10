import type { RouteObject } from 'react-router'
import { DirectoryPage } from './DirectoryPage'
import { OnboardPage } from './OnboardPage'
import { ProfilePage } from './ProfilePage'

export const peopleRoutes: RouteObject[] = [
  {
    path: 'people',
    handle: { roles: ['hr', 'management'] },
    element: <DirectoryPage />,
  },
  {
    path: 'people/new',
    handle: { roles: ['hr', 'management'] },
    element: <OnboardPage />,
  },
  {
    path: 'people/:id',
    handle: { roles: ['hr', 'management'] },
    element: <ProfilePage />,
  },
]
