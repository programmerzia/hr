import { MessageSquare } from 'lucide-react'
import { PageHeader } from '../../components/shared/PageHeader'
import { Card, EmptyState } from '../../components/ui'
import { useShared } from '../../inertia/props'
import type { Conversation, Message } from '../../types'

/** Preview shell. Messaging is not built yet, so the server sends empty lists. */
export default function ChatPage() {
  const { conversations } = useShared<{ conversations: Conversation[]; messages: Message[] }>()
  return (
    <div className="mx-auto max-w-content">
      <PageHeader title="Chat" />
      <Card>
        <EmptyState
          icon={MessageSquare}
          title="Chat is coming soon"
          description={conversations.length === 0 ? 'Conversations will appear here once messaging is available.' : undefined}
          className="py-16"
        />
      </Card>
    </div>
  )
}
