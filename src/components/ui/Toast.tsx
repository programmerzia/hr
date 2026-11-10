import { X } from 'lucide-react'
import { create } from 'zustand'
import { cn } from '../../lib/cn'
import { IconButton } from './IconButton'

export type ToastTone = 'neutral' | 'success' | 'danger'
export interface ToastItem {
  id: number
  message: string
  tone: ToastTone
}

interface ToastState {
  toasts: ToastItem[]
  push: (message: string, tone?: ToastTone) => void
  dismiss: (id: number) => void
}

let nextId = 1

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (message, tone = 'neutral') => {
    const id = nextId++
    set((s) => ({ toasts: [...s.toasts, { id, message, tone }].slice(-3) }))
    window.setTimeout(() => get().dismiss(id), 4000)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

/** Toast only when the result of an action is not visible on screen. */
export const toast = {
  show: (message: string) => useToastStore.getState().push(message, 'neutral'),
  success: (message: string) => useToastStore.getState().push(message, 'success'),
  error: (message: string) => useToastStore.getState().push(message, 'danger'),
}

const tones: Record<ToastTone, string> = {
  neutral: 'border-border',
  success: 'border-success',
  danger: 'border-danger',
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 max-w-[calc(100vw-32px)] flex-col gap-2 max-md:bottom-20"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cn(
            'pointer-events-auto flex items-start gap-2 rounded-md border bg-surface py-2 pl-3 pr-1 text-base shadow-float',
            tones[t.tone],
          )}
        >
          <p className="flex-1 py-0.5">{t.message}</p>
          <IconButton label="Dismiss" size="sm" onClick={() => dismiss(t.id)}>
            <X size={14} />
          </IconButton>
        </div>
      ))}
    </div>
  )
}
