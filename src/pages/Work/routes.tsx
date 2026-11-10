import { lazy, Suspense } from 'react'
import { Outlet, type RouteObject } from 'react-router'
import { page } from '../../app/lazy'
export const TaskDrawer = lazy(async () => ({ default: (await import('./TaskDrawer')).TaskDrawer }))

function WorkLayout() {
  return (
    <>
      <Outlet />
      <Suspense fallback={null}>
        <TaskDrawer />
      </Suspense>
    </>
  )
}


export const workRoutes: RouteObject[] = [
  {
    element: <WorkLayout />,
    children: [
      { path: 'projects', element: page(() => import('./ProjectsPage'), 'ProjectsPage') },
      { path: 'projects/:key', element: page(() => import('./BoardPage'), 'BoardPage') },
      { path: 'projects/:key/list', element: page(() => import('./ListPage'), 'ListPage') },
      { path: 'tasks', element: page(() => import('./MyTasksPage'), 'MyTasksPage') },
    ],
  },
]
