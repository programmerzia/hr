import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button, Dialog, Field, NativeSelect, RadioGroup } from '../../components/ui'
import { useSession } from '../../mock/session'
import type { BreakCategory } from '../../types'

type Mode = 'break' | 'end_day'

const categories: { value: BreakCategory; label: string }[] = [
  { value: 'short', label: 'Short break' },
  { value: 'tea', label: 'Tea break' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'official', label: 'Official step-out' },
]

export function LogoutDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const logout = useSession((s) => s.logout)
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('break')
  const [category, setCategory] = useState<BreakCategory>('short')

  const submit = () => {
    logout(mode, mode === 'break' ? category : undefined)
    onOpenChange(false)
    navigate('/login', { replace: true })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Sign out"
      description="Signing out stops your work clock. Choose how it should be recorded."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            {mode === 'break' ? 'Sign out for a break' : 'End my day'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <RadioGroup
          aria-label="Sign out type"
          value={mode}
          onValueChange={(v) => setMode(v as Mode)}
          options={[
            { value: 'break', label: 'Take a break', hint: 'Your day stays open. Signing back in resumes work.' },
            { value: 'end_day', label: 'End my day', hint: 'Closes today. Signing in again starts an overtime session.' },
          ]}
        />
        {mode === 'break' && (
          <Field label="Break type">
            <NativeSelect value={category} onChange={(e) => setCategory(e.target.value as BreakCategory)}>
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
      </div>
    </Dialog>
  )
}
