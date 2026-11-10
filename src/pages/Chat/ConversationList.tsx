import { Hash, Layers, Plus, Search, Users } from 'lucide-react'
import { NavLink } from 'react-router'
import { Avatar, EmptyState, IconButton, Input } from '../../components/ui'
import { cn } from '../../lib/cn'
import type { Conversation } from '../../types'

export interface ConversationRow {
  conversation: Conversation
  title: string
  unread: number
  /** Other person's name for DMs. */
  avatarName: string | null
}

const sections: { id: string; label: string; types: Conversation['type'][] }[] = [
  { id: 'team', label: 'Teams', types: ['team'] },
  { id: 'project', label: 'Projects', types: ['project'] },
  { id: 'direct', label: 'Direct', types: ['dm', 'group'] },
]

function RowIcon({ row }: { row: ConversationRow }) {
  const t = row.conversation.type
  if (t === 'dm' && row.avatarName) return <Avatar name={row.avatarName} size="sm" />
  const Icon = t === 'team' ? Users : t === 'project' ? Layers : Hash
  return (
    <span className="inline-flex size-6 shrink-0 items-center justify-center rounded bg-surface-2 text-fg-muted">
      <Icon size={14} aria-hidden />
    </span>
  )
}

interface Props {
  rows: ConversationRow[]
  query: string
  onQuery: (q: string) => void
  onNew: () => void
  className?: string
}

export function ConversationList({ rows, query, onQuery, onNew, className }: Props) {
  const q = query.trim().toLowerCase()
  const shown = rows.filter((r) => r.title.toLowerCase().includes(q))
  return (
    <aside aria-label="Conversations" className={cn('flex min-h-0 flex-col border-border bg-surface md:border-r', className)}>
      <div className="flex items-center gap-2 border-b border-border p-3">
        <div className="relative min-w-0 flex-1">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden />
          <Input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search conversations"
            aria-label="Search conversations"
            className="pl-8"
          />
        </div>
        <IconButton label="New message" onClick={onNew}>
          <Plus size={16} />
        </IconButton>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto py-2">
        {shown.length === 0 && (
          <EmptyState
            title={rows.length === 0 ? 'No conversations yet' : 'No matches'}
            description={rows.length === 0 ? 'Start a message to get going.' : 'Try a different name.'}
            className="py-8"
          />
        )}
        {sections.map((s) => {
          const list = shown.filter((r) => s.types.includes(r.conversation.type))
          if (list.length === 0) return null
          return (
            <section key={s.id} className="mb-2">
              <h2 className="px-3 py-1 text-xs font-medium uppercase tracking-wide text-fg-subtle">{s.label}</h2>
              <ul>
                {list.map((r) => (
                  <li key={r.conversation.id}>
                    <NavLink
                      to={`/chat/${r.conversation.id}`}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2 px-3 py-1.5 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40',
                          isActive ? 'bg-accent-soft text-fg' : 'hover:bg-surface-2',
                          r.unread > 0 ? 'font-semibold' : 'text-fg-muted',
                        )
                      }
                    >
                      <RowIcon row={r} />
                      <span className="min-w-0 flex-1 truncate">{r.title}</span>
                      {r.unread > 0 && (
                        <span
                          className="min-w-5 shrink-0 rounded-full bg-accent px-1.5 text-center text-xs font-medium text-accent-fg tabular-nums"
                          aria-label={`${r.unread} unread`}
                        >
                          {r.unread}
                        </span>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </nav>
    </aside>
  )
}
