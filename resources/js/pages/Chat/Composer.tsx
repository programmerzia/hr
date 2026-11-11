import { SendHorizontal } from 'lucide-react'
import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { IconButton, Textarea } from '../../components/ui'
import { cn } from '../../lib/cn'
import { employeeById } from '../../mock/db/people'
import { isDoneTask, useWork } from '../../mock/stores/work'

interface Suggestion {
  id: string
  label: string
  detail: string
  insert: string
}

interface Token {
  start: number
  kind: 'task' | 'mention'
  query: string
}

function tokenAt(text: string, caret: number): Token | null {
  const before = text.slice(0, caret)
  const task = /(?:^|\s)([A-Za-z]{2,6}-\d*)$/.exec(before)
  if (task) return { kind: 'task', start: caret - task[1].length, query: task[1] }
  const mention = /(?:^|\s)@([A-Za-z ]{0,30})$/.exec(before)
  if (mention) return { kind: 'mention', start: caret - mention[1].length - 1, query: mention[1] }
  return null
}

interface ComposerProps {
  placeholder: string
  memberIds: string[]
  selfId: string
  onSend: (body: string) => void
}

export function Composer({ placeholder, memberIds, selfId, onSend }: ComposerProps) {
  const tasks = useWork((s) => s.tasks)
  const columns = useWork((s) => s.columns)
  const [text, setText] = useState('')
  const [caret, setCaret] = useState(0)
  const [active, setActive] = useState(0)
  const [dismissed, setDismissed] = useState<string | null>(null)
  const ref = useRef<HTMLTextAreaElement>(null)

  const token = tokenAt(text, caret)
  const suggestions = useMemo<Suggestion[]>(() => {
    if (!token) return []
    if (token.kind === 'task') {
      const q = token.query.toUpperCase()
      return tasks
        .filter((t) => t.key.startsWith(q) && !isDoneTask(t, columns))
        .sort((a, b) => a.project_id.localeCompare(b.project_id) || a.number - b.number)
        .slice(0, 6)
        .map((t) => ({ id: t.id, label: t.key, detail: t.title, insert: t.key }))
    }
    const q = token.query.toLowerCase()
    return memberIds
      .filter((id) => id !== selfId)
      .map((id) => employeeById(id))
      .filter((e): e is NonNullable<typeof e> => !!e && e.name.toLowerCase().includes(q))
      .slice(0, 6)
      .map((e) => ({ id: e.id, label: e.name, detail: e.designation, insert: `@${e.name}` }))
  }, [token, tasks, columns, memberIds, selfId])

  const open = suggestions.length > 0 && dismissed !== `${token?.start}:${token?.query}`
  const index = Math.min(active, Math.max(suggestions.length - 1, 0))

  function pick(s: Suggestion) {
    if (!token) return
    const next = `${text.slice(0, token.start)}${s.insert} ${text.slice(caret)}`
    const pos = token.start + s.insert.length + 1
    setText(next)
    setCaret(pos)
    requestAnimationFrame(() => {
      ref.current?.focus()
      ref.current?.setSelectionRange(pos, pos)
    })
  }

  function send() {
    if (!text.trim()) return
    onSend(text)
    setText('')
    setCaret(0)
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const n = suggestions.length
        setActive((index + (e.key === 'ArrowDown' ? 1 : n - 1)) % n)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        pick(suggestions[index])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setDismissed(`${token?.start}:${token?.query}`)
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="relative border-t border-border p-3">
      {open && (
        <ul
          role="listbox"
          aria-label={token?.kind === 'task' ? 'Task suggestions' : 'People suggestions'}
          className="absolute bottom-full left-3 z-20 mb-1 w-[min(24rem,calc(100%-24px))] overflow-hidden rounded-md border border-border bg-surface shadow-float"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.id}
              role="option"
              aria-selected={i === index}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(s)
              }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                'flex cursor-pointer items-baseline gap-2 px-3 py-1.5 text-base',
                i === index ? 'bg-surface-2' : 'bg-surface',
              )}
            >
              <span className={cn('shrink-0', token?.kind === 'task' ? 'font-mono text-accent' : 'font-medium')}>
                {s.label}
              </span>
              <span className="truncate text-fg-muted">{s.detail}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-end gap-2">
        <Textarea
          ref={ref}
          rows={2}
          value={text}
          placeholder={placeholder}
          aria-label="Message"
          className="max-h-40 min-h-[52px] resize-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/25"
          onChange={(e) => {
            setText(e.target.value)
            setCaret(e.target.selectionStart)
            setActive(0)
          }}
          onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
          onKeyDown={onKeyDown}
        />
        <IconButton label="Send message" onClick={send} disabled={!text.trim()}>
          <SendHorizontal size={16} />
        </IconButton>
      </div>
      <p className="mt-1 text-xs text-fg-subtle">Enter to send, Shift+Enter for a new line. Type a task key or @ to mention.</p>
    </div>
  )
}
