import { Link } from '@inertiajs/react'
import { Printer } from 'lucide-react'
import { Button } from '../../components/ui'
import { useShared } from '../../inertia/props'
import { ClaimSheet, type ClaimDetailProps } from './ClaimSheet'

const printCss = `@page { size: A4; margin: 12mm; }
@media print { .claim-print { border: 0 !important; box-shadow: none !important; } }`

export default function ClaimPrintPage() {
  const { claim, employee, bank, weeks } = useShared<ClaimDetailProps>()
  return (
    <div className="mx-auto max-w-content p-4 sm:p-6">
      <style>{printCss}</style>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href={route('billing.claims.show', claim.id)} className="text-sm text-accent hover:underline">
          Back to claim
        </Link>
        <Button variant="primary" icon={<Printer size={14} />} onClick={() => window.print()}>
          Print or save as PDF
        </Button>
      </div>
      <ClaimSheet claim={claim} employee={employee} bank={bank} weeks={weeks} />
    </div>
  )
}

// The route is bare (no app shell): the sheet prints on its own.
ClaimPrintPage.layout = null
