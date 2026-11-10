import { MessageSquare } from 'lucide-react'
import { useMemo, useState, useSyncExternalStore } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { EmptyState } from '../../components/ui'
import { cn } from '../../lib/cn'
import { useAuthed } from '../../mock/session'
import { conversationTitle, useChat } from '../../mock/stores/chat'
import { ConversationList, type ConversationRow } from './ConversationList'
import { MessagePane } from './MessagePane'
import { NewMessageDialog } from './NewMessageDialog'

const query = '(min-width: 768px)'
function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
    () => true,
  )
}

export function ChatPage() {
  const { employee } = useAuthed()
  const { conversationId } = useParams()
  const navigate = useNavigate()
  const isDesktop = useIsDesktop()
  const conversations = useChat((s) => s.conversations)
  const members = useChat((s) => s.members)
  const messages = useChat((s) => s.messages)
  const startDm = useChat((s) => s.startDm)
  const createGroup = useChat((s) => s.createGroup)
  const [search, setSearch] = useState('')
  const [newOpen, setNewOpen] = useState(false)

  const rows = useMemo<ConversationRow[]>(() => {
    const st = useChat.getState()
    return st.conversationsFor(employee.id).map((c) => {
      const ids = members.filter((m) => m.conversation_id === c.id).map((m) => m.employee_id)
      const title = conversationTitle(c, employee.id, ids)
      return { conversation: c, title, unread: st.unreadCount(c.id, employee.id), avatarName: c.type === 'dm' ? title : null }
    })
    // conversations, members and messages are the inputs of the selectors above
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee.id, conversations, members, messages])

  const current = rows.find((r) => r.conversation.id === conversationId)

  if (!conversationId && isDesktop && rows.length > 0) {
    return <Navigate to={`/chat/${rows[0].conversation.id}`} replace />
  }
  if (conversationId && !current) return <Navigate to="/chat" replace />

  const memberIds = current ? members.filter((m) => m.conversation_id === current.conversation.id).map((m) => m.employee_id) : []
  const subtitle = current
    ? current.conversation.type === 'dm'
      ? 'Direct message'
      : `${memberIds.length} members`
    : ''

  return (
    <div className="flex h-[calc(100dvh-13rem)] min-h-[420px] overflow-hidden rounded-md border border-border shadow-xs md:h-[calc(100dvh-7rem)]">
      <ConversationList
        rows={rows}
        query={search}
        onQuery={setSearch}
        onNew={() => setNewOpen(true)}
        className={cn('w-full md:w-[280px] md:shrink-0', conversationId ? 'hidden md:flex' : 'flex')}
      />
      {current ? (
        <div className="flex min-w-0 flex-1">
          <MessagePane
            key={current.conversation.id}
            conversation={current.conversation}
            title={current.title}
            subtitle={subtitle}
            memberIds={memberIds}
            selfId={employee.id}
            selfName={employee.name}
          />
        </div>
      ) : (
        <div className="hidden min-w-0 flex-1 items-center justify-center bg-surface md:flex">
          <EmptyState icon={MessageSquare} title="Pick a conversation" description="Choose one from the list or start a new message." />
        </div>
      )}
      <NewMessageDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        selfId={employee.id}
        onDirect={(other) => navigate(`/chat/${startDm(employee.id, other).id}`)}
        onGroup={(name, ids) => navigate(`/chat/${createGroup(name, ids).id}`)}
      />
    </div>
  )
}
