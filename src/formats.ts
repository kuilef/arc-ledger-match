import { allocationsFrom, invoicesFrom, paymentsFrom, MAX_ROWS } from './domain.js';
import type { Allocation, Invoice, Payment } from './domain.js';
export const MAX_INPUT_SIZE = 2_000_000;
function bounded(text: string): void {
  if (text.length > MAX_INPUT_SIZE || new TextEncoder().encode(text).length > MAX_INPUT_SIZE) throw new Error('Input exceeds 2 MB limit');
}
export function parseCSV(input: string): Record<string, string>[] {
  bounded(input); const text = input.replace(/^\uFEFF/, '');
  const table: string[][] = []; let row: string[] = [], field = '', quoted = false, closed = false;
  const finishField = () => { row.push(field); field = ''; closed = false; };
  const finishRow = () => { finishField(); table.push(row); row = []; if (table.length > MAX_ROWS + 1) throw new Error('Too many CSV rows'); };
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else { quoted = false; closed = true; } }
      else field += c;
      continue;
    }
    if (c === ',') { finishField(); continue; }
    if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; finishRow(); continue; }
    if (closed) throw new Error('Unexpected data after quoted CSV field');
    if (c === '"') { if (field) throw new Error('Quote inside unquoted CSV field'); quoted = true; } else field += c;
  }
  if (quoted) throw new Error('Unclosed CSV quote');
  if (field || row.length || closed) finishRow();
  const headers = table.shift();
  if (!headers?.length || headers.some(x => !x || x.length > 100) || new Set(headers).size !== headers.length) throw new Error('CSV requires unique nonempty headers');
  return table.map((row, n) => {
    if (row.length !== headers.length) throw new Error(`CSV row ${n + 2} has wrong column count`);
    return Object.fromEntries(headers.map((key, i) => [key, row[i]!]));
  });
}
export function exportCSV(headers: string[], rows: Record<string, unknown>[]): string {
  const cell = (value: unknown): string => {
    let text = value === undefined || value === null ? '' : String(value);
    // Control prefixes must be covered when neutralizing spreadsheet formulas.
    // eslint-disable-next-line no-control-regex
    if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return [headers.map(cell).join(','), ...rows.map(row => headers.map(key => cell(row[key])).join(','))].join('\r\n') + '\r\n';
}
export function parseImport(text: string, format: string, kind: 'invoices'): Invoice[];
export function parseImport(text: string, format: string, kind: 'payments'): Payment[];
export function parseImport(text: string, format: string, kind: 'allocations'): Allocation[];
export function parseImport(text: string, format: string, kind: string): Invoice[] | Payment[] | Allocation[] {
  bounded(text); let data: unknown;
  if (format === 'csv') data = parseCSV(text);
  else if (format === 'json') { try { data = JSON.parse(text); } catch { throw new Error('Invalid JSON'); } }
  else throw new Error('Choose CSV or JSON');
  if (kind === 'invoices') return invoicesFrom(data);
  if (kind === 'payments') return paymentsFrom(data);
  if (kind === 'allocations') return allocationsFrom(data);
  throw new Error('Unknown import kind');
}
