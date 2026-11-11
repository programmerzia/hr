import { useState } from 'react'
import { Button, Dialog, Field, Input, RadioGroup } from '../ui'
import { useShared } from '../../inertia/props'
import type { BreakCategory } from '../../types'

// Only categories a person may choose. `idle` and `offline` are written by the system and never listed here.
function breakOptions(lunchCap: number) {
  return [
    { value: 'short', label: 'Short break' },
    { value: 'tea', label: 'Tea break' },
    { value: 'lunch', label: 'Lunch', hint: `Capped at ${lunchCap} minutes` },
    { value: 'official', label: 'Official step-out' },
  ]
}

export function BreakDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (category: BreakCategory, note?: string) => void
}) {
  const [category, setCategory] = useState<BreakCategory>('short')
  const [note, setNote] = useState('')
  const options = breakOptions(useShared().attendance?.policy?.lunch_cap_minutes ?? 60)
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Take a break"
      description="Your work clock stops until you resume."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              onConfirm(category, note)
              setNote('')
              onOpenChange(false)
            }}
          >
            Start break
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <RadioGroup
          aria-label="Break type"
          value={category}
          onValueChange={(v) => setCategory(v as BreakCategory)}
          options={options}
        />
        <Field label="Note" hint="Optional">
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} />
        </Field>
      </div>
    </Dialog>
  )
}
