# Arc Ledger Match design

Autonomous implementation authorized by the user, 2026-10-08. Separate new
project on amethyst. Local static browser app with no runtime dependencies.
Node 20.19+ builds TypeScript and serves only 127.0.0.1 by default.

The core produces an exact, reproducible reconciliation report. USDC values
use decimal strings and bigint at 18 decimals. Invoices have invoice_id,
expected_amount, optional sender/receiver and ISO UTC start_at/end_at.
Payments are user-imported observations or current Arc mainnet receipt events.
Imported observations remain unverified. A user-provided invoice_id is an
asserted reference; no RPC transfer inherently proves a commercial invoice.
Heuristic matches are candidates and never count as paid.

Allocations explicitly assign positive decimal amounts to invoice/payment
pairs with a reason. A payment can be split, but total allocations cannot exceed
its principal. References may allocate the remainder; explicit allocations have
priority. Conflicting references/constraints remain unresolved. Fees are separate.

The receipt decoder trusts only successful mainnet 5042 receipts with coherent
hash/block/log indices. Only the 18-decimal system Transfer stream contributes
principal. 6-decimal ERC20 logs are mirrors, never extra principal. ERC20-only,
legacy, mint/burn/self and malformed known-emitter cases remain unsupported.
Identical duplicate log identities collapse; conflicting duplicates reject.

CSV/JSON input is bounded, strictly validated and never rendered as HTML.
Export quotes fields and neutralizes formula-leading cells. Invoice data stays
in browser memory; only selected public hashes go to allowlisted anonymous RPCs.
RPC checks chain, uses abort timeouts, bounded sequential requests, one retry
for transient/rate-limit errors, and emits provider/time/evidence warnings.

UI: demo, invoice/payment/allocation imports, bounded hash reader, invoice table,
unallocated/candidate payment table, explicit split allocation form, expandable
report with provenance, downloadable JSON and spreadsheet-safe CSV exports.
No wallet connection, signing, transfers, authentication, analytics or CDN.

Verification: unit adversarial inputs, exact arithmetic, deduplication, allocation
budgets, RPC failure modes; browser demo/import/allocation/export/error smoke;
real public mainnet read-only probe. GitHub CI for exact published commit.
