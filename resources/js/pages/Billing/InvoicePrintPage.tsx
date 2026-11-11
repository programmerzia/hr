import { Link } from '@inertiajs/react'
import { Printer } from 'lucide-react'
import { Button } from '../../components/ui'
import { useShared } from '../../inertia/props'
import { InvoiceSheet, type InvoiceDetailProps } from './InvoiceSheet'

const printCss = `@page { size: A4; margin: 12mm; }
@media print { .invoice-print { border: 0 !important; box-shadow: none !important; } }`

export default function InvoicePrintPage() {
  const { invoice, client, project, lines, payments } = useShared<InvoiceDetailProps>()
  return (
    <div className="mx-auto max-w-content p-4 sm:p-6">
      <style>{printCss}</style>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href={route('billing.invoices.show', invoice.id)} className="text-sm text-accent hover:underline">
          Back to invoice
        </Link>
        <Button variant="primary" icon={<Printer size={14} />} onClick={() => window.print()}>
          Print or save as PDF
        </Button>
      </div>
      <InvoiceSheet invoice={invoice} client={client} project={project} lines={lines} payments={payments} asHeading />
    </div>
  )
}

// The route is bare (no app shell): the sheet prints on its own.
InvoicePrintPage.layout = null
