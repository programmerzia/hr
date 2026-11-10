import type { RouteObject } from 'react-router'
import { WorkPlaceholder } from './Placeholder'

export const workRoutes: RouteObject[] = [
  {
    path: 'projects',
    element: <WorkPlaceholder title="Projects" />,
  },
  {
    path: 'projects/:key',
    element: <WorkPlaceholder title="Board" />,
  },
  {
    path: 'projects/:key/list',
    element: <WorkPlaceholder title="Task list" />,
  },
  {
    path: 'tasks',
    element: <WorkPlaceholder title="My tasks" />,
  },
]
