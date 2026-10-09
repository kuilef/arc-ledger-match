import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('first viewport starts with results and contextual allocation, with data tools secondary', async () => {
  const html = await readFile('index.html', 'utf8');
  assert.ok(html.indexOf('id="summary"') < html.indexOf('id="import-text"'));
  assert.ok(html.indexOf('id="invoice-body"') < html.indexOf('id="import-text"'));
  assert.ok(html.includes('id="allocation-context"'));
  assert.ok(html.includes('id="data-tools"'));
  assert.ok(html.includes('id="dataset-label"'));
  assert.ok(html.includes('id="skip-link"'));
});

test('presentation keeps money exact, orders attention first and chooses money available to allocate', async () => {
  const { amountLabel, invoiceLabel, paymentLabel, choosePayment, invoiceOrder, datasetLabel } = await import('../dist/src/presentation.js');
  assert.equal(amountLabel('30.000000000000000001'), '30.000000000000000001');
  assert.equal(amountLabel('9007199254740993'), '9,007,199,254,740,993.00');
  assert.equal(amountLabel('50'), '50.00');
  assert.equal(invoiceLabel('paid'), 'Fully allocated');
  assert.equal(paymentLabel('ambiguous'), 'Needs a decision');
  const payments = [{ payment_id: 'used', unallocated_amount: '0' }, { payment_id: 'open', unallocated_amount: '50' }];
  assert.equal(choosePayment(payments, ''), 'open');
  assert.equal(choosePayment(payments, 'used'), 'used');
  assert.equal(choosePayment([], 'stale'), '');
  assert.deepEqual(['paid', 'unpaid', 'partial', 'overpaid'].sort((a, b) => invoiceOrder(a) - invoiceOrder(b)), ['overpaid', 'partial', 'unpaid', 'paid']);
  assert.equal(datasetLabel({ invoices: 'example', payments: 'example', allocations: 'example' }, false), 'Example data');
  assert.equal(datasetLabel({ invoices: 'own', payments: 'example', allocations: 'empty' }, false), 'Example + your data');
  assert.equal(datasetLabel({ invoices: 'own', payments: 'empty', allocations: 'empty' }, true), 'Your data + RPC observations');
});

test('summary aggregation accepts exact derived totals wider than individual input limits', async () => {
  const { invoicesFrom, paymentsFrom, reconcile } = await import('../dist/src/domain.js');
  const { sumAmounts } = await import('../dist/src/presentation.js');
  const input = '9'.repeat(100);
  const report = reconcile(invoicesFrom([{ invoice_id: 'I', expected_amount: '1' }]), paymentsFrom([{ payment_id: 'A', amount: input, invoice_id: 'I' }, { payment_id: 'B', amount: input, invoice_id: 'I' }]));
  assert.equal(sumAmounts(report.invoices.map(i => i.overpayment)), (2n * BigInt(input) - 1n).toString());
  assert.equal(sumAmounts(['0.000000000000000001', '0.000000000000000009']), '0.00000000000000001');
});

test('contextual review chooses the existing associated invoice for allocated payments', async () => {
  const { chooseInvoice } = await import('../dist/src/presentation.js');
  assert.equal(chooseInvoice({ payment_id: 'paid', candidates: [] }, [{ invoice_id: 'PARTIAL', remaining_amount: '10' }, { invoice_id: 'PAID', remaining_amount: '0' }], [{ payment_id: 'paid', invoice_id: 'PAID' }]), 'PAID');
  assert.equal(chooseInvoice({ payment_id: 'open', candidates: ['A', 'B'] }, [{ invoice_id: 'A', remaining_amount: '50' }, { invoice_id: 'B', remaining_amount: '50' }], []), 'A');
});
