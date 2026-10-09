import { allocationsFrom, invoicesFrom, paymentsFrom, reconcile, parseAmount } from './domain.js';
import type { Allocation, Invoice, Payment, Report } from './domain.js';
import { exportCSV, MAX_INPUT_SIZE, parseImport } from './formats.js';
import { readTransactions } from './rpc.js';
import type { RpcResult } from './rpc.js';
import { amountLabel, sumAmounts, invoiceLabel, paymentLabel, choosePayment, chooseInvoice, invoiceOrder, datasetLabel } from './presentation.js';
import type { Dataset } from './presentation.js';

function el<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element: ${id}`);
  return element as T;
}
let invoices: Invoice[] = [], payments: Payment[] = [], allocations: Allocation[] = [];
let rpc: RpcResult = { payments: [], fees: [], warnings: [], observations: [] };
let report: Report = reconcile([], []);
let dataset: Dataset = { invoices: 'empty', payments: 'empty', allocations: 'empty' };
let loading = false;
let generation = 0;
const json = (value: unknown) => JSON.stringify(value, null, 2);
function notice(message: string, error = false): void {
  const node = el('notice'); node.textContent = message; node.className = error ? 'error' : '';
}
function guarded(action: () => void): void {
  try { action(); } catch (error) { notice(error instanceof Error ? error.message : 'Invalid input', true); }
}
function commit(nextInvoices: Invoice[], nextPayments: Payment[], nextAllocations: Allocation[], nextRpc: RpcResult = rpc, nextDataset: Dataset = dataset): void {
  const next = reconcile(nextInvoices, nextPayments, nextAllocations);
  generation++;
  invoices = nextInvoices; payments = nextPayments; allocations = nextAllocations; rpc = nextRpc; report = next; dataset = nextDataset; render();
}
function cell(row: HTMLTableRowElement, text: string): HTMLTableCellElement {
  const td = row.insertCell(); td.textContent = text;
  const labels = row.parentElement?.id === 'invoice-body' ? ['Invoice', 'Expected', 'Allocated', 'Remaining / extra', 'Status', 'Evidence'] : ['Payment / source', 'Amount', 'Available', 'Resolution', 'Possible matches / warnings', 'Source', 'Action'];
  td.dataset.label = labels[td.cellIndex] ?? '';
  if (td.cellIndex > 0 && td.cellIndex < (row.parentElement?.id === 'invoice-body' ? 4 : 3)) td.className = 'number';
  return td;
}
function detail(td: HTMLElement, title: string, data: unknown): void {
  const details = document.createElement('details'), summary = document.createElement('summary'), pre = document.createElement('pre');
  summary.textContent = title; pre.textContent = json(data); details.append(summary, pre); td.append(details);
}
function status(td: HTMLElement, label: string, display = label): void {
  const span = document.createElement('span'); span.className = `status ${label}`; span.textContent = display; td.append(span);
}
function select(id: string, entries: { value: string; label: string }[]): void {
  const node = el<HTMLSelectElement>(id), previous = node.value;
  node.replaceChildren(...entries.map(entry => { const option = document.createElement('option'); option.value = entry.value; option.textContent = entry.label; return option; }));
  if (entries.some(entry => entry.value === previous)) node.value = previous;
}
function snapshot(): unknown {
  return { schema_version: 1, generated_at: new Date().toISOString(), purpose: 'Local allocation evidence; not a financial/tax audit or commercial proof', inputs: { invoices, imported_payments: payments.filter(x => x.provenance.kind === 'imported-unverified').map(p => ({ payment_id: p.payment_id, amount: p.amount, sender: p.sender, receiver: p.receiver, occurred_at: p.occurred_at, invoice_id: p.invoice_id })), explicit_allocations: allocations }, report, rpc };
}
function render(): void {
  const body = el<HTMLTableSectionElement>('invoice-body'); body.replaceChildren();
  for (const invoice of [...report.invoices].sort((a, b) => invoiceOrder(a.status) - invoiceOrder(b.status))) {
    const tr = body.insertRow(); cell(tr, invoice.invoice_id); cell(tr, amountLabel(invoice.expected_amount)); cell(tr, amountLabel(invoice.allocated_amount));
    cell(tr, invoice.overpayment !== '0' ? `+${amountLabel(invoice.overpayment)} extra` : amountLabel(invoice.remaining_amount));
    status(cell(tr, ''), invoice.status, invoiceLabel(invoice.status)); detail(cell(tr, ''), invoice.evidence.length ? `${invoice.evidence.length} record${invoice.evidence.length === 1 ? '' : 's'}` : 'No allocation', invoice.evidence);
  }
  if (!invoices.length) cell(body.insertRow(), 'No invoices. Import your records or load the synthetic demo.').colSpan = 6;
  const paymentBody = el<HTMLTableSectionElement>('payment-body'); paymentBody.replaceChildren();
  for (const payment of [...report.payments].sort((a, b) => Number(b.unallocated_amount !== '0') - Number(a.unallocated_amount !== '0'))) {
    const tr = paymentBody.insertRow(), first = cell(tr, payment.payment_id), sub = document.createElement('span');
    sub.className = 'sub'; sub.textContent = payment.provenance.kind === 'rpc-observed' ? 'RPC observation · not invoice proof' : 'Imported · unverified'; first.append(sub);
    cell(tr, amountLabel(payment.amount)); cell(tr, amountLabel(payment.unallocated_amount)); status(cell(tr, ''), payment.resolution, paymentLabel(payment.resolution));
    cell(tr, [...payment.candidates, ...payment.warnings].join(' · ') || '—');
    detail(cell(tr, ''), 'View source', { sender: payment.sender, receiver: payment.receiver, occurred_at: payment.occurred_at, provenance: payment.provenance, allocations: report.allocations.filter(a => a.payment_id === payment.payment_id) });
    const action = document.createElement('button'); action.textContent = payment.unallocated_amount !== '0' ? 'Allocate' : 'Review'; action.className = 'row-action';
    action.setAttribute('aria-label', `${action.textContent} ${payment.payment_id}`); action.addEventListener('click', () => { focusPayment(payment.payment_id); if (payment.unallocated_amount === '0') { const source = tr.querySelector('details'); if (source) source.open = true; } }); cell(tr, '').append(action);
  }
  if (!payments.length) cell(paymentBody.insertRow(), 'No payment observations.').colSpan = 7;
  const available = report.payments.filter(p => p.unallocated_amount !== '0');
  const totalAvailable = sumAmounts(available.map(p => p.unallocated_amount));
  const extra = sumAmounts(report.invoices.map(i => i.overpayment));
  const reviewCount = report.invoices.filter(i => i.status !== 'paid').length;
  const summary = el('summary'); summary.replaceChildren();
  for (const [label, value, note, attention] of [
    ['Invoices to review', String(reviewCount), `of ${invoices.length} invoices`, reviewCount > 0],
    ['Fully allocated', String(invoices.length - reviewCount), 'in this local ledger', false],
    ['Available to allocate', amountLabel(totalAvailable), `USDC · ${available.length} payment${available.length === 1 ? '' : 's'}`, available.length > 0],
    ['Extra allocated', amountLabel(extra), 'USDC · review with your records', extra !== '0'],
  ] as const) {
    const box = document.createElement('div'), count = document.createElement('strong'), text = document.createElement('span'), caption = document.createElement('small');
    box.className = attention ? 'metric attention' : 'metric'; text.textContent = label; count.textContent = value; caption.textContent = note; box.append(text, count, caption); summary.append(box);
  }
  el('invoice-count').textContent = String(invoices.length); el('payment-count').textContent = String(payments.length); el('allocation-count').textContent = String(allocations.length);
  el('dataset-label').textContent = datasetLabel(dataset, rpc.observations.length > 0);
  el('dataset-label').classList.toggle('has-example', Object.values(dataset).includes('example'));
  el('next-title').textContent = available.length ? `${amountLabel(totalAvailable)} USDC needs an allocation decision` : reviewCount ? `${reviewCount} invoice${reviewCount === 1 ? '' : 's'} to review` : invoices.length ? 'Every invoice is fully allocated' : 'Start with your invoices';
  el('next-description').textContent = available.length ? 'A possible match is a suggestion. Choose the invoice only when your records support it.' : reviewCount ? 'Check remaining and extra amounts below. Add payment records if needed.' : invoices.length ? 'Review the source evidence, then export a record of your decisions.' : 'Import your records below, or reload the example to explore.';
  el<HTMLButtonElement>('next-action').disabled = !available.length;
  const paymentSelection = choosePayment(report.payments, el<HTMLSelectElement>('allocation-payment').value);
  select('allocation-payment', report.payments.map(p => ({ value: p.payment_id, label: `${p.payment_id} · ${amountLabel(p.unallocated_amount)} available` })));
  el<HTMLSelectElement>('allocation-payment').value = paymentSelection;
  select('allocation-invoice', [...report.invoices].sort((a, b) => Number(b.remaining_amount !== '0') - Number(a.remaining_amount !== '0')).map(i => ({ value: i.invoice_id, label: i.invoice_id })));
  updateAllocationContext();
  const explicit = el('explicit-list'); explicit.replaceChildren();
  for (const allocation of allocations) {
    const row = document.createElement('div'), label = document.createElement('span'), remove = document.createElement('button');
    row.className = 'explicit-item'; label.textContent = `${allocation.payment_id} → ${allocation.invoice_id}: ${allocation.amount} USDC · ${allocation.reason}`;
    remove.textContent = 'Remove'; remove.addEventListener('click', () => guarded(() => { commit(invoices, payments, allocations.filter(x => x !== allocation)); notice('Explicit allocation removed. Imported references may allocate its remainder.'); }));
    row.append(label, remove); explicit.append(row);
  }
  if (!allocations.length) explicit.textContent = 'No explicit allocations saved yet.';
  el('full-report').textContent = json(snapshot()); el('rpc-count').textContent = `(${rpc.observations.length} requests)`;
  el('rpc-evidence').textContent = rpc.observations.length ? json({ fees: rpc.fees, warnings: rpc.warnings, observations: rpc.observations }) : 'No live RPC reads yet.';
}
function updateAllocationContext(): void {
  const payment = report.payments.find(p => p.payment_id === el<HTMLSelectElement>('allocation-payment').value);
  const node = el('allocation-context'); node.replaceChildren();
  if (payment) {
    const value = document.createElement('strong'), note = document.createElement('span');
    value.textContent = `${amountLabel(payment.unallocated_amount)} USDC available`;
    note.textContent = payment.unallocated_amount === '0' ? `All ${amountLabel(payment.amount)} USDC is allocated. Review existing allocations before changing this pair.` : `of ${amountLabel(payment.amount)} USDC total · ${payment.candidates.length} possible match${payment.candidates.length === 1 ? '' : 'es'}`;
    node.append(value, note);
  } else node.textContent = 'Import payments or reload the example to allocate.';
  el<HTMLButtonElement>('save-allocation').disabled = !payment || !invoices.length;
}
function focusPayment(id: string): void {
  el<HTMLSelectElement>('allocation-payment').value = id;
  const payment = report.payments.find(p => p.payment_id === id);
  const candidate = payment ? chooseInvoice(payment, report.invoices, report.allocations) : undefined;
  if (candidate) el<HTMLSelectElement>('allocation-invoice').value = candidate;
  updateAllocationContext(); el('allocation-invoice').focus();
}
el('allocation-payment').addEventListener('change', updateAllocationContext);
el('next-action').addEventListener('click', () => { const payment = report.payments.find(p => p.unallocated_amount !== '0'); if (payment) focusPayment(payment.payment_id); });
function download(name: string, type: string, data: string): void {
  const url = URL.createObjectURL(new Blob([data], { type })), link = document.createElement('a');
  link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function demo(): Promise<void> {
  if (loading) return;
  const revision = ++generation;
  try {
    const [i, p, a] = await Promise.all(['invoices', 'payments', 'allocations'].map(async name => { const response = await fetch(`demo/${name}.json`); if (!response.ok) throw new Error('Demo file unavailable; run npm run build'); return response.json() as Promise<unknown>; }));
    if (revision !== generation || loading) return;
    commit(invoicesFrom(i), paymentsFrom(p), allocationsFrom(a), { payments: [], fees: [], warnings: [], observations: [] }, { invoices: 'example', payments: 'example', allocations: 'example' });
    notice('');
  } catch (error) { if (revision === generation) notice(error instanceof Error ? error.message : 'Demo load failed', true); }
}
el('demo-button').addEventListener('click', () => { void demo(); });
el('clear-button').addEventListener('click', () => {
  if (loading) return;
  commit([], [], [], { payments: [], fees: [], warnings: [], observations: [] }, { invoices: 'empty', payments: 'empty', allocations: 'empty' }); notice('Ledger cleared from browser memory.');
});
el('import-button').addEventListener('click', () => guarded(() => {
  if (loading) return;
  generation++;
  const text = el<HTMLTextAreaElement>('import-text').value, format = el<HTMLSelectElement>('import-format').value, kind = el<HTMLSelectElement>('import-kind').value;
  if (kind === 'invoices') commit(parseImport(text, format, 'invoices'), payments, [], rpc, { ...dataset, invoices: 'own', allocations: 'empty' });
  else if (kind === 'payments') {
    const next = parseImport(text, format, 'payments');
    commit(invoices, next, [], { payments: [], fees: [], warnings: [], observations: [] }, { ...dataset, payments: 'own', allocations: 'empty' });
  } else commit(invoices, payments, parseImport(text, format, 'allocations'), rpc, { ...dataset, allocations: 'own' });
  notice(kind === 'allocations' ? 'Explicit allocations replaced.' : `${kind} imported. Explicit allocations reset; re-import them after both collections are loaded.`);
}));
el<HTMLInputElement>('import-file').addEventListener('change', () => {
  const file = el<HTMLInputElement>('import-file').files?.[0]; if (!file) return;
  if (file.size > MAX_INPUT_SIZE) { notice('Input exceeds 2 MB limit', true); return; }
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension !== 'csv' && extension !== 'json') { notice('Choose a CSV or JSON file', true); return; }
  void file.text().then(text => { el<HTMLTextAreaElement>('import-text').value = text; el<HTMLSelectElement>('import-format').value = extension; notice('File read locally. Click Import rows to validate and apply.'); });
});
el('allocation-form').addEventListener('submit', event => {
  event.preventDefault(); guarded(() => {
    if (loading) return;
    const row = allocationsFrom([{ payment_id: el<HTMLSelectElement>('allocation-payment').value, invoice_id: el<HTMLSelectElement>('allocation-invoice').value, amount: el<HTMLInputElement>('allocation-amount').value, reason: el<HTMLInputElement>('allocation-reason').value }])[0]!;
    commit(invoices, payments, [...allocations.filter(x => x.invoice_id !== row.invoice_id || x.payment_id !== row.payment_id), row], rpc, { ...dataset, allocations: 'own' });
    notice('Explicit allocation saved. Principal budget and invoice status recomputed.');
  });
});
el('rpc-button').addEventListener('click', () => {
  if (loading) return;
  generation++;
  loading = true; const button = el<HTMLButtonElement>('rpc-button'); button.disabled = true; button.textContent = 'Reading bounded receipts…';
  const hashes = el<HTMLTextAreaElement>('tx-hashes').value.trim().split(/[\s,]+/), provider = el<HTMLSelectElement>('rpc-provider').value;
  notice('Reading selected public hashes. Invoice metadata stays in this browser.');
  void readTransactions(hashes, provider).then(next => {
    // Refresh the selected hash group atomically, including unavailable/unsupported receipts.
    const selected = new Set(hashes.map(hash => hash.toLowerCase()));
    const observed = new Map(payments.filter(p => p.provenance.kind !== 'rpc-observed' || !selected.has(p.provenance.tx_hash!)).map(p => [p.payment_id, p]));
    for (const payment of next.payments) observed.set(payment.payment_id, payment);
    const totals = new Map<string, bigint>(); for (const a of allocations) totals.set(a.payment_id, (totals.get(a.payment_id) ?? 0n) + parseAmount(a.amount));
    const invalid = new Set([...totals].filter(([id, amount]) => !observed.has(id) || amount > parseAmount(observed.get(id)!.amount)).map(([id]) => id));
    const nextAllocations = allocations.filter(a => !invalid.has(a.payment_id));
    for (const id of invalid) next.warnings.push(`Invalidated explicit allocations for ${id}: selected evidence unavailable, unsupported or principal changed`);
    const nextPayments = [...observed.values()];
    const feeMap = new Map(rpc.fees.filter(f => !selected.has(f.tx_hash)).map(f => [f.tx_hash, f])); for (const fee of next.fees) feeMap.set(fee.tx_hash, fee);
    if (rpc.observations.length + next.observations.length > 1000) next.warnings.push('RPC history capped at 1000 observations; export before extended sessions');
    const nextRpc = { payments: nextPayments.filter(p => p.provenance.kind === 'rpc-observed'), fees: [...feeMap.values()], observations: [...rpc.observations, ...next.observations].slice(-1000), warnings: next.warnings };
    commit(invoices, nextPayments, nextAllocations, nextRpc);
    notice(`${next.payments.length} observed transfer(s); ${next.warnings.length} warning(s). Review RPC evidence. No invoice was attributed by RPC.`, next.warnings.length > 0);
  }).catch(error => notice(error instanceof Error ? error.message : 'RPC read failed', true)).finally(() => { loading = false; button.disabled = false; button.textContent = 'Read selected hashes'; });
});
el('export-json').addEventListener('click', () => download('arc-ledger-report.json', 'application/json', json(snapshot())));
el('export-invoices').addEventListener('click', () => download('arc-ledger-invoices.csv', 'text/csv', exportCSV(['invoice_id', 'expected_amount', 'allocated_amount', 'remaining_amount', 'overpayment', 'status', 'evidence'], report.invoices.map(i => ({ ...i, evidence: json(i.evidence) })))));
el('export-payments').addEventListener('click', () => download('arc-ledger-payments.csv', 'text/csv', exportCSV(['payment_id', 'amount', 'allocated_amount', 'unallocated_amount', 'resolution', 'source_kind', 'tx_hash', 'candidates', 'warnings'], report.payments.map(p => ({ ...p, source_kind: p.provenance.kind, tx_hash: p.provenance.tx_hash, candidates: p.candidates.join(' | '), warnings: p.warnings.join(' | ') })))));
el('export-allocations').addEventListener('click', () => download('arc-ledger-allocations.csv', 'text/csv', exportCSV(['invoice_id', 'payment_id', 'amount', 'reason'], allocations.map(a => ({ ...a })))));
el('export-allocations-json').addEventListener('click', () => download('arc-ledger-allocations.json', 'application/json', json(allocations)));
render(); void demo();
