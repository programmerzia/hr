import type { RouteObject } from 'react-router'
import { ChatPlaceholder } from './Placeholder'

export const chatRoutes: RouteObject[] = [
  {
    path: 'chat',
    element: <ChatPlaceholder title="Chat" />,
  },
  {
    path: 'chat/:conversationId',
    element: <ChatPlaceholder title="Chat" />,
  },
]
