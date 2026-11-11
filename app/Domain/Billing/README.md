# Billing

Port one-to-one from `resources/js/mock/stores/billing.ts` (same validation messages). Invokable classes in `Actions/`.

Actions to port:
- [ ] Clients: CreateClient, UpdateClient
- [ ] Invoices: CreateInvoice, SendInvoice, RecordPayment, VoidInvoice, MarkOverdue
- [ ] Claims: GenerateClaim, SubmitClaim, VerifyClaim (lead), ApproveClaim, PayClaim
