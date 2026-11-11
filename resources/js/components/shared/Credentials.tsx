import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../ui'

/** Sign-in details HR hands to a person: username, temporary password, one Copy action. */
export function Credentials({ email, password }: { email: string; password: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Username: ${email}\nTemporary password: ${password}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable; the values are selectable on screen
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-2 rounded-md border border-border bg-surface-2 p-3 text-sm">
        <dt className="text-fg-muted">Username</dt>
        <dd className="break-all font-mono">{email}</dd>
        <dt className="text-fg-muted">Temporary password</dt>
        <dd className="font-mono">{password}</dd>
      </dl>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-fg-muted">They must change this password at first sign-in.</p>
        <Button onClick={copy} className="shrink-0">
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  )
}
