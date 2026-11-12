import { useState, type ReactNode } from 'react'
import { Button, Dialog, Field, Textarea } from '../../components/ui'

/** Reason dialog used for requesting, approving and rejecting regularizations. */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  confirmLabel,
  required = true,
  destructive,
  disabled,
  children,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  label: string
  confirmLabel: string
  required?: boolean
  destructive?: boolean
  /** Extra condition that blocks confirming (e.g. a required picker in `children`). */
  disabled?: boolean
  /** Extra fields shown above the reason (kind selector, resolution picker). */
  children?: ReactNode
  onConfirm: (text: string) => void
}) {
  const [text, setText] = useState('')
  const [touched, setTouched] = useState(false)
  const invalid = required && !text.trim()
  const close = (o: boolean) => {
    if (!o) {
      setText('')
      setTouched(false)
    }
    onOpenChange(o)
  }
  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            disabled={invalid || disabled}
            onClick={() => {
              setTouched(true)
              if (invalid || disabled) return
              onConfirm(text.trim())
              close(false)
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        {children}
        <Field label={label} required={required} error={touched && invalid ? 'Add a short reason.' : undefined}>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={300} />
        </Field>
      </div>
    </Dialog>
  )
}
