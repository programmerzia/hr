import type { RouteObject } from 'react-router'
import { InboxPlaceholder } from './Placeholder'

export const inboxRoutes: RouteObject[] = [
  {
    path: 'inbox',
    element: <InboxPlaceholder title="Inbox" />,
  },
]
