import { mkdir, writeFile } from 'node:fs/promises';
import { readTransactions, PROVIDERS } from '../dist/src/rpc.js';
const evidence = { checked_at: new Date().toISOString(), purpose: 'Read-only public mainnet smoke; no private invoices, wallets, signing or transfers', discoveries: [], outcome: 'incomplete', live: null };
let id = 0;
async function call(provider, method, params) {
  const observed_at = new Date().toISOString(), requestId = ++id;
  try {
    const response = await fetch(provider, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: requestId, method, params }), signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text(); if (text.length > 2_000_000) throw new Error('Response too large');
    const body = JSON.parse(text);
    if (body.id !== requestId || body.jsonrpc !== '2.0' || body.error) throw new Error(`Invalid RPC result ${JSON.stringify(body.error ?? {})}`);
    evidence.discoveries.push({ provider, observed_at, method, params, status: 'ok', result: body.result }); return body.result;
  } catch (error) { evidence.discoveries.push({ provider, observed_at, method, params, status: 'error', error: error.message }); throw error; }
}
try {
  const chain = await call(PROVIDERS[0], 'eth_chainId', []);
  if (chain !== '0x13b2') throw new Error(`Wrong chain ${chain}`);
  try { await call(PROVIDERS[1], 'eth_chainId', []); } catch { /* Recorded alternate provider failure does not erase primary evidence. */ }
  const head = BigInt(await call(PROVIDERS[0], 'eth_blockNumber', []));
  let hashes = [];
  for (const lag of [32n, 64n]) {
    const block = await call(PROVIDERS[0], 'eth_getBlockByNumber', ['0x' + (head > lag ? head - lag : 0n).toString(16), false]);
    if (!block || !Array.isArray(block.transactions)) continue;
    hashes = block.transactions.slice(0, 3); if (hashes.length) break;
  }
  if (!hashes.length) throw new Error('No public transactions found in two bounded sampled blocks');
  evidence.selected_public_hashes = hashes;
  evidence.live = await readTransactions([...hashes, '0x' + '0'.repeat(64)], PROVIDERS[0]);
  evidence.outcome = evidence.live.payments.length ? 'mainnet-transfers-observed' : 'mainnet-receipts-observed-no-supported-transfers';
} catch (error) { evidence.error = error.message; }
await mkdir('evidence', { recursive: true });
await writeFile('evidence/live-mainnet.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({ checked_at: evidence.checked_at, outcome: evidence.outcome, public_hashes: evidence.selected_public_hashes, payments: evidence.live?.payments.length ?? 0, warnings: evidence.live?.warnings, discovery_errors: evidence.discoveries.filter(x => x.status === 'error') }, null, 2));
if (evidence.outcome === 'incomplete') process.exitCode = 1;
