import { formatAmount } from './domain.js';
/** Display-only helpers. All financial calculations remain in domain.ts. */
export function amountLabel(value: string): string {
  const [whole = '0', fraction = ''] = value.split('.');
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction.padEnd(2, '0')}`;
}
export function invoiceLabel(value: string): string {
  return ({ paid: 'Fully allocated', partial: 'Partly allocated', overpaid: 'Overallocated', unpaid: 'Unallocated' } as Record<string, string>)[value] ?? value;
}
export function paymentLabel(value: string): string {
  return ({ allocated: 'Fully allocated', ambiguous: 'Needs a decision', 'candidate-only': 'Possible match', unmatched: 'No match', partial: 'Partly allocated', unallocated: 'Not allocated' } as Record<string, string>)[value] ?? value.replaceAll('-', ' ');
}
export function invoiceOrder(status: string): number { return ({ overpaid: 0, partial: 1, unpaid: 2, paid: 3 } as Record<string, number>)[status] ?? 4; }
export function choosePayment(payments: { payment_id: string; unallocated_amount: string }[], previous: string): string {
  return payments.find(p => p.payment_id === previous)?.payment_id ?? payments.find(p => p.unallocated_amount !== '0')?.payment_id ?? payments[0]?.payment_id ?? '';
}
export type Dataset = Record<'invoices' | 'payments' | 'allocations', 'example' | 'own' | 'empty'>;
export function datasetLabel(dataset: Dataset, observed: boolean): string {
  const values = Object.values(dataset), example = values.includes('example'), own = values.includes('own');
  const label = example ? (own || observed ? 'Example + your data' : 'Example data') : own ? 'Your data' : observed ? 'RPC observations' : 'Empty ledger';
  return observed && (own || example) ? `${label} + RPC observations` : label;
}

/** Sum already-validated report amounts, whose totals may exceed the input width. */
export function sumAmounts(values: string[]): string {
  return formatAmount(values.reduce((sum, value) => {
    const [whole = '0', fraction = ''] = value.split('.');
    return sum + BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, '0'));
  }, 0n));
}

export function chooseInvoice(payment: { payment_id: string; candidates: string[] }, invoices: { invoice_id: string; remaining_amount: string }[], allocations: { payment_id: string; invoice_id: string }[]): string | undefined {
  return payment.candidates.find(id => invoices.some(i => i.invoice_id === id && i.remaining_amount !== '0')) ?? allocations.find(a => a.payment_id === payment.payment_id)?.invoice_id;
}
