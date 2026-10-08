import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_ROWS, MAX_CANDIDATE_LINKS, parseAmount, formatAmount, invoicesFrom, paymentsFrom, allocationsFrom, reconcile } from '../dist/src/domain.js';
import { parseCSV, exportCSV, parseImport } from '../dist/src/formats.js';

const invoice = (id, amount = '100', extra = {}) => ({ invoice_id: id, expected_amount: amount, ...extra });
const payment = (id, amount, extra = {}) => ({ payment_id: id, amount, ...extra });
const run = (i, p, a = []) => reconcile(invoicesFrom(i), paymentsFrom(p), allocationsFrom(a));

test('exact decimal strings preserve 18 decimals and values above Number precision', () => {
  assert.equal(parseAmount('123456789012345678.000000000000000001'), 123456789012345678000000000000000001n);
  assert.equal(formatAmount(1000001n), '0.000000000001000001');
  assert.equal(formatAmount(parseAmount('1.000001')), '1.000001');
});
test('rejects float numbers, signs, exponent, excess precision and nonpositive principals', () => {
  for (const value of [1.1, '-1', '1e2', '0.0000000000000000001', 'Infinity', ' 1', '01']) assert.throws(() => parseAmount(value));
  assert.throws(() => invoicesFrom([invoice('A', '0')]));
});
test('multiple asserted references expose partial, full and overpayment with provenance', () => {
  const r = run([invoice('A'), invoice('B'), invoice('C')], [payment('p1', '40', { invoice_id: 'A' }), payment('p2', '60', { invoice_id: 'B' }), payment('p3', '50', { invoice_id: 'B' })]);
  assert.deepEqual(r.invoices.map(x => [x.status, x.allocated_amount]), [['partial', '40'], ['overpaid', '110'], ['unpaid', '0']]);
  assert.equal(r.invoices[1].overpayment, '10');
  assert.equal(r.allocations[0].basis, 'imported-reference');
  assert.equal(r.payments[0].provenance.kind, 'imported-unverified');
});
test('amount/address hints remain candidates even with only one candidate', () => {
  const r = run([invoice('A')], [payment('p', '100')]);
  assert.equal(r.invoices[0].status, 'unpaid');
  assert.deepEqual(r.payments[0].candidates, ['A']);
  assert.equal(r.payments[0].unallocated_amount, '100');
});
test('ambiguous equal invoices never consume payment', () => {
  const r = run([invoice('A'), invoice('B')], [payment('p', '100')]);
  assert.deepEqual(r.payments[0].candidates, ['A', 'B']);
  assert.equal(r.payments[0].resolution, 'ambiguous');
  assert.ok(r.invoices.every(x => x.status === 'unpaid'));
});
test('explicit split allocations share principal without reuse and allow multiple payments', () => {
  const r = run([invoice('A', '60'), invoice('B', '50')], [payment('p', '100'), payment('q', '10')], [
    { invoice_id: 'A', payment_id: 'p', amount: '60', reason: 'local ledger' },
    { invoice_id: 'B', payment_id: 'p', amount: '40', reason: 'split agreed' },
    { invoice_id: 'B', payment_id: 'q', amount: '10', reason: 'balance' },
  ]);
  assert.ok(r.invoices.every(x => x.status === 'paid'));
  assert.ok(r.payments.every(x => x.unallocated_amount === '0'));
});
test('over-budget, unknown and duplicate pair allocations reject atomically', () => {
  for (const a of [
    [{ invoice_id: 'A', payment_id: 'p', amount: '80', reason: 'x' }, { invoice_id: 'B', payment_id: 'p', amount: '80', reason: 'y' }],
    [{ invoice_id: 'C', payment_id: 'p', amount: '1', reason: 'x' }],
    [{ invoice_id: 'A', payment_id: 'p', amount: '1', reason: 'x' }, { invoice_id: 'A', payment_id: 'p', amount: '1', reason: 'y' }],
  ]) assert.throws(() => run([invoice('A'), invoice('B')], [payment('p', '100')], a));
});
test('explicit allocation has priority over reference and only remainder is allocated', () => {
  const r = run([invoice('A'), invoice('B')], [payment('p', '100', { invoice_id: 'A' })], [{ invoice_id: 'B', payment_id: 'p', amount: '70', reason: 'explicit split' }]);
  assert.deepEqual(r.invoices.map(x => x.allocated_amount), ['30', '70']);
});
test('duplicate invoice/payment identities and forged imported provenance reject', () => {
  assert.throws(() => invoicesFrom([invoice('A'), invoice('A')]));
  assert.throws(() => paymentsFrom([payment('p', '1'), payment('p', '1')]));
  assert.throws(() => paymentsFrom([payment('p', '1', { provenance: { kind: 'rpc' } })]));
});
test('sender/receiver/date constraints gate asserted references and missing dates', () => {
  const sender = '0x' + '1'.repeat(40);
  const r = run([invoice('A', '100', { sender, start_at: '2026-10-01T00:00:00Z', end_at: '2026-10-10T00:00:00Z' })], [payment('p', '100', { invoice_id: 'A' })]);
  assert.equal(r.invoices[0].status, 'unpaid');
  assert.match(r.payments[0].warnings.join(' '), /reference/);
  assert.throws(() => invoicesFrom([invoice('A', '1', { start_at: '2026-02-30T00:00:00Z' })]));
  assert.throws(() => invoicesFrom([invoice('A', '1', { start_at: '2026-10-10T00:00:00Z', end_at: '2026-10-01T00:00:00Z' })]));
});
test('malformed objects and oversized collections/fields reject', () => {
  for (const value of [null, {}, [null], [{ invoice_id: 'A', expected_amount: 1 }], [invoice('<A>', '1', { sender: 'x' })]]) assert.throws(() => invoicesFrom(value));
  assert.throws(() => invoicesFrom(Array.from({ length: 5001 }, (_, n) => invoice(String(n)))));
  assert.throws(() => invoicesFrom([invoice('x'.repeat(301))]));
});
test('CSV reads quoted commas, quotes, newlines and CRLF with strict row width', () => {
  assert.deepEqual(parseCSV('invoice_id,expected_amount\r\n"A,""x""\nB",10\r\n'), [{ invoice_id: 'A,"x"\nB', expected_amount: '10' }]);
  for (const value of ['a,a\n1,2', 'a,b\n1', 'a\n"broken', 'a\n"ok"junk', 'a\nx"y']) assert.throws(() => parseCSV(value));
});
test('spreadsheet export neutralizes formulas including leading whitespace/control characters', () => {
  const csv = exportCSV(['id', 'note'], [{ id: '=CMD()', note: '\t@SUM(1,2)' }, { id: '+evil', note: 'safe"quote\nnext' }, { id: '-1', note: '\r=evil' }]);
  const r = parseCSV(csv);
  assert.equal(r[0].id, "'=CMD()");
  assert.equal(r[0].note, "'\t@SUM(1,2)");
  assert.equal(r[1].note, 'safe"quote\nnext');
  assert.equal(r[2].note, "'\r=evil");
});
test('JSON import remains local asserted input; strict size and invalid JSON error', () => {
  assert.equal(parseImport('[{"invoice_id":"A","expected_amount":"1"}]', 'json', 'invoices')[0].invoice_id, 'A');
  assert.throws(() => parseImport('{', 'json', 'invoices'));
  assert.throws(() => parseImport('x'.repeat(2_000_001), 'csv', 'invoices'));
});
test('candidate expansion rejects atomically above 5000 total links', () => {
  // 71 × 71 reproduces overflow safely; no gigabyte report is serialized.
  const i = invoicesFrom(Array.from({ length: 71 }, (_, n) => invoice(`I${n}`, '1')));
  const p = paymentsFrom(Array.from({ length: 71 }, (_, n) => payment(`P${n}`, '1')));
  const before = JSON.stringify([i, p]);
  assert.throws(() => reconcile(i, p), /Candidate link budget exceeded.*5000/);
  assert.equal(JSON.stringify([i, p]), before);
});
test('candidate budget accepts exactly its bound and rejects maximum-size supported collections safely', () => {
  const boundary = run(Array.from({ length: 100 }, (_, n) => invoice(`I${n}`, '1')), Array.from({ length: 50 }, (_, n) => payment(`P${n}`, '1')));
  assert.equal(boundary.payments.reduce((sum, p) => sum + p.candidates.length, 0), MAX_CANDIDATE_LINKS);
  const rawInvoices = Array.from({ length: MAX_ROWS }, (_, n) => invoice(`I${n.toString().padStart(4, '0')}${'x'.repeat(295)}`, '1'));
  const rawPayments = Array.from({ length: MAX_ROWS }, (_, n) => payment(`P${n.toString().padStart(4, '0')}${'y'.repeat(295)}`, '1'));
  const invoiceJSON = JSON.stringify(rawInvoices), paymentJSON = JSON.stringify(rawPayments);
  assert.ok(invoiceJSON.length < 2_000_000 && paymentJSON.length < 2_000_000);
  const i = parseImport(invoiceJSON, 'json', 'invoices'), p = parseImport(paymentJSON, 'json', 'payments');
  assert.equal(i.length, MAX_ROWS); assert.equal(p.length, MAX_ROWS);
  assert.equal(i[0].invoice_id.length, 300); assert.equal(p[0].payment_id.length, 300);
  // The guard aborts at link 5001. No full Cartesian report or giant JSON is built.
  assert.throws(() => reconcile(i, p), /Candidate link budget exceeded.*5000/);
  assert.equal(i[0].invoice_id, rawInvoices[0].invoice_id);
  assert.equal(p[MAX_ROWS - 1].payment_id, rawPayments[MAX_ROWS - 1].payment_id);
});
test('JSON allocations preserve formula-leading IDs/reasons; spreadsheet CSV is deliberately not lossless', () => {
  const i = invoicesFrom([invoice('-INV', '1')]), p = paymentsFrom([payment('+PAY', '1')]);
  const a = [{ invoice_id: '-INV', payment_id: '+PAY', amount: '1', reason: '=reference' }];
  const jsonRows = parseImport(JSON.stringify(a), 'json', 'allocations');
  assert.deepEqual(jsonRows, a);
  assert.equal(reconcile(i, p, jsonRows).invoices[0].status, 'paid');
  const csvRows = parseImport(exportCSV(['invoice_id', 'payment_id', 'amount', 'reason'], a), 'csv', 'allocations');
  assert.deepEqual(csvRows[0], { invoice_id: "'-INV", payment_id: "'+PAY", amount: '1', reason: "'=reference" });
  assert.throws(() => reconcile(i, p, csvRows), /unknown invoice\/payment/);
});
