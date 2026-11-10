import { Outlet, type RouteObject } from 'react-router'
import { TaskDrawer } from '../Work/routes'
import { ChatPage } from './ChatPage'

function ChatLayout() {
  return (
    <>
      <Outlet />
      <TaskDrawer />
    </>
  )
}

export const chatRoutes: RouteObject[] = [
  {
    element: <ChatLayout />,
    children: [
      { path: 'chat', element: <ChatPage /> },
      { path: 'chat/:conversationId', element: <ChatPage /> },
    ],
  },
]
