import { create } from 'zustand'
import { persistStore } from '../persist'
import { navBadges } from '../../app/nav'
import type { Conversation, ConversationMember, Message, MessageAttachment } from '../../types'
import { conversationMembers, conversations, messages } from '../db/chat'
import { employeeById } from '../db/people'
import { useSession } from '../session'

interface ChatState {
  conversations: Conversation[]
  members: ConversationMember[]
  messages: Message[]

  sendMessage: (
    conversationId: string,
    authorId: string,
    body: string,
    attachments?: MessageAttachment[],
  ) => Message | null
  markRead: (conversationId: string, employeeId: string) => void
  /** Returns the existing DM between the two people or creates one. */
  startDm: (aId: string, bId: string) => Conversation
  createGroup: (name: string, memberIds: string[]) => Conversation

  conversationsFor: (employeeId: string) => Conversation[]
  unreadCount: (conversationId: string, employeeId: string) => number
  totalUnread: (employeeId: string) => number
  messagesFor: (conversationId: string) => Message[]
  membersOf: (conversationId: string) => string[]
}

let msgCounter = 900000
let convCounter = 0

export const useChat = create<ChatState>((set, get) => ({
  conversations,
  members: conversationMembers,
  messages,

  sendMessage: (conversationId, authorId, body, attachments = []) => {
    const text = body.trim()
    if (!text && attachments.length === 0) return null
    const s = get()
    if (!s.members.some((m) => m.conversation_id === conversationId && m.employee_id === authorId)) return null
    const message: Message = {
      id: `msg-${Date.now().toString(36)}-${++msgCounter}`,
      conversation_id: conversationId,
      author_id: authorId,
      body: text,
      attachments,
      created_at: new Date().toISOString(),
    }
    set({
      messages: [...s.messages, message],
      members: s.members.map((m) =>
        m.conversation_id === conversationId && m.employee_id === authorId
          ? { ...m, last_read_message_id: message.id }
          : m,
      ),
    })
    return message
  },

  markRead: (conversationId, employeeId) => {
    const s = get()
    let last: Message | undefined
    for (let i = s.messages.length - 1; i >= 0; i--) {
      if (s.messages[i].conversation_id === conversationId) {
        last = s.messages[i]
        break
      }
    }
    if (!last) return
    const mine = s.members.find((m) => m.conversation_id === conversationId && m.employee_id === employeeId)
    if (!mine || mine.last_read_message_id === last.id) return
    const lastId = last.id
    set({
      members: s.members.map((m) =>
        m.conversation_id === conversationId && m.employee_id === employeeId
          ? { ...m, last_read_message_id: lastId }
          : m,
      ),
    })
  },

  startDm: (aId, bId) => {
    const s = get()
    const existing = s.conversations.find((c) => {
      if (c.type !== 'dm') return false
      const ids = s.members.filter((m) => m.conversation_id === c.id).map((m) => m.employee_id)
      return ids.length === 2 && ids.includes(aId) && ids.includes(bId)
    })
    if (existing) return existing
    const conv: Conversation = { id: `cv-dm-rt-${Date.now().toString(36)}-${++convCounter}`, type: 'dm', name: null, team_id: null, project_id: null }
    set({
      conversations: [...s.conversations, conv],
      members: [
        ...s.members,
        ...[aId, bId].map((employee_id) => ({ conversation_id: conv.id, employee_id, last_read_message_id: null })),
      ],
    })
    return conv
  },

  createGroup: (name, memberIds) => {
    const s = get()
    const conv: Conversation = {
      id: `cv-grp-rt-${Date.now().toString(36)}-${++convCounter}`,
      type: 'group',
      name: name.trim() || 'New group',
      team_id: null,
      project_id: null,
    }
    set({
      conversations: [...s.conversations, conv],
      members: [
        ...s.members,
        ...[...new Set(memberIds)].map((employee_id) => ({
          conversation_id: conv.id,
          employee_id,
          last_read_message_id: null,
        })),
      ],
    })
    return conv
  },

  conversationsFor: (employeeId) => {
    const s = get()
    const mine = new Set(s.members.filter((m) => m.employee_id === employeeId).map((m) => m.conversation_id))
    const lastAt = new Map<string, number>()
    for (const m of s.messages) lastAt.set(m.conversation_id, new Date(m.created_at).getTime())
    return s.conversations
      .filter((c) => mine.has(c.id))
      .sort((a, b) => (lastAt.get(b.id) ?? Number.MAX_SAFE_INTEGER) - (lastAt.get(a.id) ?? Number.MAX_SAFE_INTEGER))
  },

  unreadCount: (conversationId, employeeId) => {
    const s = get()
    const mine = s.members.find((m) => m.conversation_id === conversationId && m.employee_id === employeeId)
    if (!mine) return 0
    let seenRead = mine.last_read_message_id === null
    let count = 0
    for (const m of s.messages) {
      if (m.conversation_id !== conversationId) continue
      if (!seenRead) {
        if (m.id === mine.last_read_message_id) seenRead = true
        continue
      }
      if (m.author_id !== employeeId) count++
    }
    return count
  },

  totalUnread: (employeeId) => {
    const s = get()
    return s.members
      .filter((m) => m.employee_id === employeeId)
      .reduce((sum, m) => sum + s.unreadCount(m.conversation_id, employeeId), 0)
  },

  messagesFor: (conversationId) => get().messages.filter((m) => m.conversation_id === conversationId),

  membersOf: (conversationId) =>
    get()
      .members.filter((m) => m.conversation_id === conversationId)
      .map((m) => m.employee_id),
}))

persistStore(useChat, 'chat', ['conversations', 'members', 'messages'])

/** Title for a conversation as seen by the viewer (DMs show the other person). */
export function conversationTitle(
  c: Conversation,
  viewerId: string,
  memberIds: string[],
): string {
  if (c.type === 'dm') {
    const other = memberIds.find((id) => id !== viewerId) ?? memberIds[0]
    return (other && employeeById(other)?.name) || 'Direct message'
  }
  return c.name ?? 'Conversation'
}

navBadges.set('chat', () => {
  const id = useSession((s) => s.employee?.id)
  return useChat((s) => (id ? s.totalUnread(id) : 0))
})
