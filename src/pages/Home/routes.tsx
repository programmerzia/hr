import { Outlet, type RouteObject } from 'react-router'
import { TaskDrawer } from '../Work/routes'
import { HomePage } from './HomePage'

function HomeLayout() {
  return (
    <>
      <Outlet />
      <TaskDrawer />
    </>
  )
}

export const homeRoutes: RouteObject[] = [{ element: <HomeLayout />, children: [{ index: true, element: <HomePage /> }] }]
