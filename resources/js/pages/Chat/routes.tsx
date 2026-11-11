import { Suspense } from 'react'
import { Outlet, type RouteObject } from 'react-router'
import { page } from '../../app/lazy'
import { TaskDrawer } from '../Work/routes'

function ChatLayout() {
  return (
    <>
      <Outlet />
      <Suspense fallback={null}>
        <TaskDrawer />
      </Suspense>
    </>
  )
}

export const chatRoutes: RouteObject[] = [
  {
    element: <ChatLayout />,
    children: [
      { path: 'chat', element: page(() => import('./ChatPage'), 'ChatPage') },
      { path: 'chat/:conversationId', element: page(() => import('./ChatPage'), 'ChatPage') },
    ],
  },
]
