import { format, isToday, isYesterday } from 'date-fns'
import { ArrowLeft, Copy, ListTodo, MessageSquare } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router'
import { toast } from '../../components/ui'
import { Avatar, EmptyState, IconButton } from '../../components/ui'
import { parseTaskRefs } from '../../lib/taskRefs'
import { formatTime } from '../../lib/format'
import { employeeById } from '../../mock/db/people'
import { useChat } from '../../mock/stores/chat'
import { useWork } from '../../mock/stores/work'
import type { Conversation, Message } from '../../types'
import { Composer } from './Composer'
import { MessageText, TaskCard } from './MessageText'

const dayLabel = (iso: string) => {
  const d = new Date(iso)
  return isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'EEEE d MMM')
}

interface Group {
  key: string
  author: string
  messages: Message[]
}

function groupMessages(list: Message[], unreadId: string | null): { day: string; groups: Group[] }[] {
  const days: { day: string; groups: Group[] }[] = []
  for (const m of list) {
    const label = dayLabel(m.created_at)
    let day = days[days.length - 1]
    if (!day || day.day !== label) {
      day = { day: label, groups: [] }
      days.push(day)
    }
    const last = day.groups[day.groups.length - 1]
    const prev = last?.messages[last.messages.length - 1]
    if (m.id !== unreadId && last && last.author === m.author_id && prev && +new Date(m.created_at) - +new Date(prev.created_at) < 5 * 60_000) {
      last.messages.push(m)
    } else {
      day.groups.push({ key: m.id, author: m.author_id, messages: [m] })
    }
  }
  return days
}

interface Props {
  conversation: Conversation
  title: string
  subtitle: string
  memberIds: string[]
  selfId: string
  selfName: string
}

export function MessagePane({ conversation, title, subtitle, memberIds, selfId, selfName }: Props) {
  const all = useChat((s) => s.messages)
  const send = useChat((s) => s.sendMessage)
  const markRead = useChat((s) => s.markRead)
  const projects = useWork((s) => s.projects)
  const list = useMemo(() => all.filter((m) => m.conversation_id === conversation.id), [all, conversation.id])
  // First message the viewer has not read, captured before markRead clears it.
  const unreadId = useMemo(() => {
    const st = useChat.getState()
    const mine = st.members.find((m) => m.conversation_id === conversation.id && m.employee_id === selfId)
    if (!mine || mine.last_read_message_id === null) return null
    const mineList = st.messages.filter((m) => m.conversation_id === conversation.id)
    const at = mineList.findIndex((m) => m.id === mine.last_read_message_id)
    return mineList.slice(at + 1).find((m) => m.author_id !== selfId)?.id ?? null
  }, [conversation.id, selfId])
  const days = useMemo(() => groupMessages(list, unreadId), [list, unreadId])
  const navigate = useNavigate()
  const scroller = useRef<HTMLDivElement>(null)
  const count = list.length

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
    markRead(conversation.id, selfId)
  }, [conversation.id, count, selfId, markRead])

  const projectName = conversation.project_id ? projects.find((p) => p.id === conversation.project_id)?.name : null
  const shownMembers = memberIds.slice(0, 5)

  return (
    <section aria-label={title} className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <IconButton label="Back to conversations" size="sm" className="md:hidden" onClick={() => navigate('/chat')}>
          <ArrowLeft size={16} />
        </IconButton>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">{title}</h1>
          <p className="truncate text-sm text-fg-muted">{projectName ? `${projectName}. ${subtitle}` : subtitle}</p>
        </div>
        <ul className="flex shrink-0 -space-x-1.5" aria-label="Members">
          {shownMembers.map((id) => {
            const name = employeeById(id)?.name ?? id
            return (
              <li key={id} title={name} className="rounded-full ring-2 ring-surface">
                <Avatar name={name} size="sm" />
              </li>
            )
          })}
          {memberIds.length > shownMembers.length && (
            <li className="inline-flex size-6 items-center justify-center rounded-full bg-surface-2 text-xs text-fg-muted ring-2 ring-surface">
              +{memberIds.length - shownMembers.length}
            </li>
          )}
        </ul>
      </header>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {days.length === 0 && (
          <EmptyState icon={MessageSquare} title="No messages yet" description="Say hello to get the conversation started." />
        )}
        {days.map((d) => (
          <div key={d.day}>
            <div className="relative my-4 flex justify-center">
              <span className="absolute inset-x-0 top-1/2 h-px bg-border" aria-hidden />
              <span className="relative rounded-full border border-border bg-surface px-3 py-0.5 text-xs font-medium text-fg-muted">
                {d.day}
              </span>
            </div>
            {d.groups.map((g) => {
              const name = employeeById(g.author)?.name ?? g.author
              return (
                <div key={g.key}>
                {g.messages[0]?.id === unreadId && (
                  <div className="my-3 flex items-center gap-3 text-xs font-medium text-danger" data-testid="unread-divider">
                    <span className="h-px flex-1 bg-danger/40" />
                    New
                  </div>
                )}
                <article className="mb-3 flex gap-3">
                  <Avatar name={name} size="md" className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-baseline gap-2">
                      <span className="font-medium">{name}</span>
                      <time className="text-xs text-fg-subtle" dateTime={g.messages[0].created_at}>
                        {formatTime(g.messages[0].created_at)}
                      </time>
                    </p>
                    {g.messages.map((m) => {
                      const refs = [...new Set(parseTaskRefs(m.body))]
                      return (
                        <div key={m.id} className="group/msg relative -mx-2 rounded px-2 py-0.5 transition-colors duration-150 hover:bg-surface-2">
                          <div className="absolute -top-3 right-2 z-10 hidden items-center rounded-md border border-border bg-surface p-0.5 shadow-xs group-hover/msg:flex group-focus-within/msg:flex">
                            <IconButton
                              label="Copy link"
                              size="sm"
                              onClick={() => {
                                void navigator.clipboard?.writeText(`${location.origin}/chat/${conversation.id}#${m.id}`)
                                toast.success('Link copied')
                              }}
                            >
                              <Copy size={14} />
                            </IconButton>
                            {refs[0] && (
                              <IconButton label={`Open ${refs[0]}`} size="sm" onClick={() => navigate({ search: `?task=${refs[0]}` })}>
                                <ListTodo size={14} />
                              </IconButton>
                            )}
                          </div>
                          <MessageText body={m.body} selfName={selfName} />
                          {refs.map((r) => (
                            <TaskCard key={r} taskKey={r} />
                          ))}
                        </div>
                      )
                    })}
                  </div>
                </article>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <Composer
        placeholder={`Message ${title}`}
        memberIds={memberIds}
        selfId={selfId}
        onSend={(body) => send(conversation.id, selfId, body)}
      />
    </section>
  )
}
