export const MAX_ROWS = 5000;
export const MAX_CANDIDATE_LINKS = 5000;
const SCALE = 10n ** 18n;
export interface Invoice {
  invoice_id: string; expected_amount: string;
  sender?: string; receiver?: string; start_at?: string; end_at?: string;
}
export interface LogEvidence { emitter: string; log_index: string; raw_units: string; decimals: 6 | 18 }
export interface Provenance {
  kind: 'imported-unverified' | 'rpc-observed'; label: string;
  provider?: string; observed_at?: string; tx_hash?: string;
  block_hash?: string; block_number?: string; logs?: LogEvidence[];
}
export interface Payment {
  payment_id: string; amount: string; sender?: string; receiver?: string;
  occurred_at?: string; invoice_id?: string; provenance: Provenance;
}
export interface Allocation { invoice_id: string; payment_id: string; amount: string; reason: string }
export interface AppliedAllocation extends Allocation { basis: 'explicit-user' | 'imported-reference' }
export interface Report {
  schema_version: 1; explanation: string;
  invoices: (Invoice & { allocated_amount: string; remaining_amount: string; overpayment: string; status: 'unpaid' | 'partial' | 'paid' | 'overpaid'; evidence: AppliedAllocation[] })[];
  payments: (Payment & { allocated_amount: string; unallocated_amount: string; candidates: string[]; resolution: string; warnings: string[] })[];
  allocations: AppliedAllocation[];
}
export function record(value: unknown, label = 'input'): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}: expected an object`);
  return value as Record<string, unknown>;
}
export function stringField(value: unknown, label: string, max = 300): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || value.includes('\0')) throw new Error(`${label}: expected nonempty string (max ${max})`);
  return value;
}
export function parseAmount(value: unknown): bigint {
  if (typeof value !== 'string' || value.length > 100 || !/^(0|[1-9]\d*)(\.\d{1,18})?$/.test(value)) throw new Error('Amount must be an unsigned exact decimal string, up to 18 decimals');
  const [whole = '0', fraction = ''] = value.split('.');
  return BigInt(whole) * SCALE + BigInt(fraction.padEnd(18, '0'));
}
export function formatAmount(value: bigint): string {
  if (value < 0n) throw new Error('Negative amount');
  const fraction = (value % SCALE).toString().padStart(18, '0').replace(/0+$/, '');
  return `${value / SCALE}${fraction ? `.${fraction}` : ''}`;
}
function positive(value: unknown): string {
  const units = parseAmount(value);
  if (units <= 0n) throw new Error('Principal/expected/allocation amount must be positive');
  return formatAmount(units);
}
export function address(value: unknown): string {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(value)) throw new Error('Invalid 20-byte address');
  return value.toLowerCase();
}
export function isoDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value)) throw new Error('Date must be ISO UTC, e.g. 2026-10-08T00:00:00Z');
  const date = new Date(value), normalized = value.includes('.') ? value : value.replace('Z', '.000Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== normalized) throw new Error('Invalid calendar date');
  return date.toISOString();
}
function rows(value: unknown): unknown[] {
  if (!Array.isArray(value) || value.length > MAX_ROWS) throw new Error(`Expected array with at most ${MAX_ROWS} rows`);
  return value;
}
function keys(row: Record<string, unknown>, allowed: string[]): void {
  for (const key of Object.keys(row)) if (!allowed.includes(key)) throw new Error(`Unknown field: ${key}`);
}
function optional(row: Record<string, unknown>, key: string): unknown { return row[key] === '' || row[key] === undefined ? undefined : row[key]; }
export function unique<T>(items: T[], key: (item: T) => string): void {
  const ids = new Set<string>();
  for (const item of items) { const id = key(item); if (ids.has(id)) throw new Error(`Duplicate identity: ${id}`); ids.add(id); }
}
export function invoicesFrom(value: unknown): Invoice[] {
  const result = rows(value).map((value, n) => {
    const row = record(value, `Invoice ${n + 1}`);
    keys(row, ['invoice_id', 'expected_amount', 'sender', 'receiver', 'start_at', 'end_at']);
    const invoice: Invoice = { invoice_id: stringField(row.invoice_id, 'invoice_id'), expected_amount: positive(row.expected_amount) };
    for (const key of ['sender', 'receiver'] as const) if (optional(row, key) !== undefined) invoice[key] = address(row[key]);
    for (const key of ['start_at', 'end_at'] as const) if (optional(row, key) !== undefined) invoice[key] = isoDate(row[key]);
    if (invoice.start_at && invoice.end_at && invoice.start_at > invoice.end_at) throw new Error('Invoice window is reversed');
    return invoice;
  });
  unique(result, x => x.invoice_id); return result;
}
export function paymentsFrom(value: unknown): Payment[] {
  const result = rows(value).map((value, n) => {
    const row = record(value, `Payment ${n + 1}`);
    keys(row, ['payment_id', 'amount', 'sender', 'receiver', 'occurred_at', 'invoice_id']);
    const payment: Payment = { payment_id: stringField(row.payment_id, 'payment_id'), amount: positive(row.amount), provenance: { kind: 'imported-unverified', label: 'User-imported observation; not RPC verified' } };
    if (payment.payment_id.startsWith('arc:')) throw new Error('arc: identity namespace is reserved for RPC evidence');
    for (const key of ['sender', 'receiver'] as const) if (optional(row, key) !== undefined) payment[key] = address(row[key]);
    if (optional(row, 'occurred_at') !== undefined) payment.occurred_at = isoDate(row.occurred_at);
    if (optional(row, 'invoice_id') !== undefined) payment.invoice_id = stringField(row.invoice_id, 'invoice_id');
    return payment;
  });
  unique(result, x => x.payment_id); return result;
}
export function allocationsFrom(value: unknown): Allocation[] {
  return rows(value).map(value => {
    const row = record(value, 'Allocation'); keys(row, ['invoice_id', 'payment_id', 'amount', 'reason']);
    return { invoice_id: stringField(row.invoice_id, 'invoice_id'), payment_id: stringField(row.payment_id, 'payment_id'), amount: positive(row.amount), reason: stringField(row.reason, 'reason') };
  });
}
function constraints(invoice: Invoice, payment: Payment): boolean {
  if (invoice.sender && invoice.sender !== payment.sender) return false;
  if (invoice.receiver && invoice.receiver !== payment.receiver) return false;
  if ((invoice.start_at || invoice.end_at) && !payment.occurred_at) return false;
  if (invoice.start_at && payment.occurred_at! < invoice.start_at) return false;
  if (invoice.end_at && payment.occurred_at! > invoice.end_at) return false;
  return true;
}
export function reconcile(invoices: Invoice[], payments: Payment[], explicit: Allocation[] = []): Report {
  if (invoices.length > MAX_ROWS || payments.length > MAX_ROWS || explicit.length > MAX_ROWS) throw new Error('Too many rows');
  unique(invoices, x => x.invoice_id); unique(payments, x => x.payment_id); unique(explicit, x => JSON.stringify([x.invoice_id, x.payment_id]));
  const invoiceMap = new Map(invoices.map(x => [x.invoice_id, x])), paymentMap = new Map(payments.map(x => [x.payment_id, x]));
  const spent = new Map<string, bigint>(), received = new Map<string, bigint>(), applied: AppliedAllocation[] = [];
  const warnings = new Map(payments.map(x => [x.payment_id, [] as string[]]));
  const add = (allocation: AppliedAllocation) => {
    const payment = paymentMap.get(allocation.payment_id), invoice = invoiceMap.get(allocation.invoice_id);
    if (!payment || !invoice) throw new Error('Allocation refers to unknown invoice/payment');
    const amount = parseAmount(positive(allocation.amount)), used = (spent.get(payment.payment_id) ?? 0n) + amount;
    if (used > parseAmount(payment.amount)) throw new Error(`Allocation exceeds payment principal: ${payment.payment_id}`);
    spent.set(payment.payment_id, used); received.set(invoice.invoice_id, (received.get(invoice.invoice_id) ?? 0n) + amount); applied.push(allocation);
    if (!constraints(invoice, payment)) warnings.get(payment.payment_id)!.push(`Explicit allocation overrides constraints for ${invoice.invoice_id}; review reason`);
  };
  for (const allocation of explicit) add({ ...allocation, reason: stringField(allocation.reason, 'reason'), basis: 'explicit-user' });
  for (const payment of payments) {
    positive(payment.amount); if (!payment.invoice_id) continue;
    const invoice = invoiceMap.get(payment.invoice_id), remainder = parseAmount(payment.amount) - (spent.get(payment.payment_id) ?? 0n);
    if (!invoice || !constraints(invoice, payment)) warnings.get(payment.payment_id)!.push(`Unresolved imported reference ${payment.invoice_id}: missing invoice or conflicting/missing constraints`);
    else if (remainder > 0n) add({ invoice_id: invoice.invoice_id, payment_id: payment.payment_id, amount: formatAmount(remainder), reason: 'Invoice reference asserted in imported observation; no onchain commercial proof', basis: 'imported-reference' });
  }
  let candidateLinks = 0;
  return {
    schema_version: 1,
    explanation: 'Statuses reflect explicit local allocations or user-imported invoice references. RPC confirms observed transfer evidence only, never its commercial purpose. Imported payments are unverified. Candidate matches never count as paid.',
    invoices: invoices.map(invoice => {
      const total = received.get(invoice.invoice_id) ?? 0n, expected = parseAmount(invoice.expected_amount);
      const status = total === 0n ? 'unpaid' : total < expected ? 'partial' : total === expected ? 'paid' : 'overpaid';
      return { ...invoice, status, allocated_amount: formatAmount(total), remaining_amount: formatAmount(expected > total ? expected - total : 0n), overpayment: formatAmount(total > expected ? total - expected : 0n), evidence: applied.filter(x => x.invoice_id === invoice.invoice_id) };
    }),
    payments: payments.map(payment => {
      const total = spent.get(payment.payment_id) ?? 0n, remainder = parseAmount(payment.amount) - total;
      const candidates: string[] = [];
      if (remainder > 0n) for (const invoice of invoices) {
        if (!constraints(invoice, payment) || (!invoice.sender && !invoice.receiver && parseAmount(invoice.expected_amount) !== parseAmount(payment.amount))) continue;
        if (candidateLinks === MAX_CANDIDATE_LINKS) throw new Error(`Candidate link budget exceeded (${MAX_CANDIDATE_LINKS} total links). Narrow sender/receiver/date filters or split imports.`);
        candidateLinks++; candidates.push(invoice.invoice_id);
      }
      return { ...payment, allocated_amount: formatAmount(total), unallocated_amount: formatAmount(remainder), candidates, resolution: remainder === 0n ? 'allocated' : candidates.length > 1 ? 'ambiguous' : candidates.length === 1 ? 'candidate-only' : 'unallocated', warnings: warnings.get(payment.payment_id)! };
    }),
    allocations: applied,
  };
}
