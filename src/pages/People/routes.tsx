import type { RouteObject } from 'react-router'
import { PeoplePlaceholder } from './Placeholder'

export const peopleRoutes: RouteObject[] = [
  {
    path: 'people',
    handle: { roles: ['hr', 'management'] },
    element: <PeoplePlaceholder title="People" />,
  },
  {
    path: 'people/new',
    handle: { roles: ['hr', 'management'] },
    element: <PeoplePlaceholder title="Add person" />,
  },
  {
    path: 'people/:id',
    handle: { roles: ['hr', 'management'] },
    element: <PeoplePlaceholder title="Profile" />,
  },
]
