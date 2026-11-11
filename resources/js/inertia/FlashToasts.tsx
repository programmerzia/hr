import { useEffect } from 'react'
import { toast } from '../components/ui'
import { useShared } from './props'

/** Turns the `flash` shared prop into toasts, once per server response. */
export function FlashToasts() {
  const { flash } = useShared()
  useEffect(() => {
    if (flash?.success) toast.success(flash.success)
    if (flash?.error) toast.error(flash.error)
  }, [flash])
  return null
}
