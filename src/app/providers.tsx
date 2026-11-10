import type { ReactNode } from 'react'
import { Toaster, TooltipProvider } from '../components/ui'
import './theme'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider>
      {children}
      <Toaster />
    </TooltipProvider>
  )
}
