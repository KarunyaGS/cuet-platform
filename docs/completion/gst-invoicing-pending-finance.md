# GST, tax invoices and credit notes – PENDING FINANCE CONFIRMATION

The CEO approved GST-inclusive prices and tax invoices (decision 2). **No GST rate, SAC code, GSTIN, address, invoice number format or place-of-supply rule has been invented or stored.** The 18% figures in the CEO checklist are illustration only.

Needed from finance before any invoice code is written:
1. GST rate and SAC code for the service; GSTIN, legal name, registered address.
2. Invoice series format and financial-year reset (gap-free numbering per financial year).
3. Place of supply for students in other states or without a state on record (IGST vs CGST+SGST); whether the checkout must ask for the student's state.
4. Credit-note practice for full and partial refunds (the approved refund rule shortens the pass; the credit note must match the refunded amount).
5. Whether Razorpay's fee GST is claimed, and who files returns.

Technical plan (unchanged, see `payments-audit-and-plan.md`): migrations 0035 (invoice and credit-note tables with a per-year counter, tax fields on the order) and later; one invoice per captured payment, created once even if the webhook repeats; credit note per refund; the order amount stays the GST-inclusive total so checkout and signature checks do not change. Nothing is built until the items above are answered.
