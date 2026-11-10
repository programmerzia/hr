import { Outlet, type RouteObject } from 'react-router'
import { BoardPage } from './BoardPage'
import { ListPage } from './ListPage'
import { MyTasksPage } from './MyTasksPage'
import { ProjectsPage } from './ProjectsPage'
import { TaskDrawer } from './TaskDrawer'

function WorkLayout() {
  return (
    <>
      <Outlet />
      <TaskDrawer />
    </>
  )
}

export { TaskDrawer }

export const workRoutes: RouteObject[] = [
  {
    element: <WorkLayout />,
    children: [
      { path: 'projects', element: <ProjectsPage /> },
      { path: 'projects/:key', element: <BoardPage /> },
      { path: 'projects/:key/list', element: <ListPage /> },
      { path: 'tasks', element: <MyTasksPage /> },
    ],
  },
]
