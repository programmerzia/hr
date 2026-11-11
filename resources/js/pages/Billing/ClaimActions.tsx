import { router, useForm } from '@inertiajs/react'
import { BadgeCheck, CircleDollarSign, Send, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Button, Dialog, Field, Input, toast } from '../../components/ui'
import type { ContractorClaim } from '../../types'
import { errorText, isoToday } from './helpers'

export type ClaimMode = 'contractor' | 'lead' | 'management' | 'hr'
/** The one step the server says the viewer can take on a claim (ContractorClaimPolicy::next). */
export type ClaimAction = 'submit' | 'verify' | 'approve' | 'pay'

function PayDialog({ claim, onClose }: { claim: ContractorClaim; onClose: () => void }) {
  const form = useForm({ paid_on: isoToday(), reference: '' })
  const { data } = form
  const errors = form.errors as Record<string, string>
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
            disabled={!data.paid_on || form.processing}
            onClick={() =>
              form.post(route('billing.claims.pay', claim.id), {
                preserveScroll: true,
                onSuccess: onClose,
              })
            }
          >
            Mark as paid
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 pb-2">
        <Field label="Paid on" required error={errorText(errors)}>
          <Input
            type="date"
            value={data.paid_on}
            onChange={(e) => {
              form.clearErrors()
              form.setData('paid_on', e.target.value)
            }}
          />
        </Field>
        <Field label="Transfer reference">
          <Input value={data.reference} onChange={(e) => form.setData('reference', e.target.value)} />
        </Field>
      </div>
    </Dialog>
  )
}

const steps = {
  submit: { label: 'Submit', icon: <Send size={14} /> },
  verify: { label: 'Verify hours', icon: <ShieldCheck size={14} /> },
  approve: { label: 'Approve', icon: <BadgeCheck size={14} /> },
} as const

/** The button for the step the viewer can take on this claim. Renders nothing when there is none. */
export function ClaimActions({
  claim,
  action,
  size = 'sm',
}: {
  claim: ContractorClaim
  action: ClaimAction | null | undefined
  size?: 'sm' | 'md'
}) {
  const [paying, setPaying] = useState(false)
  if (!action) return null

  const run = () =>
    router.post(
      route(`billing.claims.${action}`, claim.id),
      {},
      {
        preserveScroll: true,
        onError: (e) => toast.error(errorText(e) ?? 'Could not complete this step'),
      },
    )

  return (
    <span onClick={(e) => e.stopPropagation()} className="inline-flex">
      {action === 'pay' ? (
        <Button size={size} variant="primary" icon={<CircleDollarSign size={14} />} onClick={() => setPaying(true)}>
          Mark as paid
        </Button>
      ) : (
        <Button size={size} variant="primary" icon={steps[action].icon} onClick={run}>
          {steps[action].label}
        </Button>
      )}
      {paying && <PayDialog claim={claim} onClose={() => setPaying(false)} />}
    </span>
  )
}
