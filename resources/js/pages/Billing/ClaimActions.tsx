import { BadgeCheck, CircleDollarSign, Send, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Button, Dialog, Field, Input, toast } from '../../components/ui'
import { useAuthed } from '../../mock/session'
import { useBilling } from '../../mock/stores/billing'
import { usePeopleStore } from '../../mock/stores/people'
import type { ContractorClaim, Role } from '../../types'
import { isoToday } from './helpers'

export type ClaimMode = 'contractor' | 'lead' | 'management'

export function claimMode(role: Role): ClaimMode {
  return role === 'management' ? 'management' : role === 'team_lead' ? 'lead' : 'contractor'
}

function PayDialog({ claim, onClose }: { claim: ContractorClaim; onClose: () => void }) {
  const payClaim = useBilling((s) => s.payClaim)
  const [paidOn, setPaidOn] = useState(isoToday())
  const [reference, setReference] = useState('')
  const [error, setError] = useState<string | undefined>()
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Mark claim as paid"
      description="Record the bank transfer you made for this claim."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!paidOn}
            onClick={() => {
              const res = payClaim(claim.id, paidOn, reference)
              if (!res.ok) return setError(res.error)
              onClose()
            }}
          >
            Mark as paid
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 pb-2">
        <Field label="Paid on" required error={error}>
          <Input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
        </Field>
        <Field label="Transfer reference">
          <Input value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  )
}

/** Buttons for whatever step the viewer can take on this claim. Renders nothing when there is none. */
export function ClaimActions({ claim, size = 'sm' }: { claim: ContractorClaim; size?: 'sm' | 'md' }) {
  const { employee, role } = useAuthed()
  const b = useBilling()
  const leadId = usePeopleStore((s) => s.leadOf(claim.employee_id)?.id)
  const [paying, setPaying] = useState(false)
  const stop = (e: React.MouseEvent) => e.stopPropagation()
  const run = (res: { ok: boolean } & { error?: string }) => {
    if (!res.ok) toast.error(res.error ?? 'Could not complete this step')
  }

  let button: React.ReactNode = null
  if (claim.employee_id === employee.id && claim.status === 'draft') {
    button = (
      <Button size={size} variant="primary" icon={<Send size={14} />} onClick={() => run(b.submitClaim(claim.id))}>
        Submit
      </Button>
    )
  } else if (role === 'team_lead' && claim.status === 'submitted' && leadId === employee.id) {
    button = (
      <Button size={size} variant="primary" icon={<ShieldCheck size={14} />} onClick={() => run(b.verifyClaim(claim.id, employee.id))}>
        Verify hours
      </Button>
    )
  } else if (role === 'management' && claim.status === 'verified') {
    button = (
      <Button size={size} variant="primary" icon={<BadgeCheck size={14} />} onClick={() => run(b.approveClaim(claim.id, employee.id))}>
        Approve
      </Button>
    )
  } else if (role === 'management' && claim.status === 'approved') {
    button = (
      <Button size={size} variant="primary" icon={<CircleDollarSign size={14} />} onClick={() => setPaying(true)}>
        Mark as paid
      </Button>
    )
  }
  if (!button) return null
  return (
    <span onClick={stop} className="inline-flex">
      {button}
      {paying && <PayDialog claim={claim} onClose={() => setPaying(false)} />}
    </span>
  )
}
