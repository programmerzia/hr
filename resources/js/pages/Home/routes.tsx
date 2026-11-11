import { Suspense } from 'react'
import { Outlet, type RouteObject } from 'react-router'
import { page } from '../../app/lazy'
import { TaskDrawer } from '../Work/routes'

function HomeLayout() {
  return (
    <>
      <Outlet />
      <Suspense fallback={null}>
        <TaskDrawer />
      </Suspense>
    </>
  )
}

export const homeRoutes: RouteObject[] = [{ element: <HomeLayout />, children: [{ index: true, element: page(() => import('./HomePage'), 'HomePage') }] }]
