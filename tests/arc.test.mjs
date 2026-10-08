import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { decodeReceipt, SYSTEM, ERC20, TRANSFER, CHAIN } from '../dist/src/arc.js';
import { readTransactions, PROVIDERS } from '../dist/src/rpc.js';
import { reconcile, invoicesFrom, allocationsFrom } from '../dist/src/domain.js';

const hash = '0x' + 'a'.repeat(64), blockHash = '0x' + 'b'.repeat(64);
const from = '0x' + '1'.repeat(40), to = '0x' + '2'.repeat(40);
const word = n => '0x' + BigInt(n).toString(16).padStart(64, '0');
const addressWord = a => '0x' + a.slice(2).padStart(64, '0');
const log = (address, value, index = '0x0', extra = {}) => ({ address, topics: [TRANSFER, addressWord(from), addressWord(to)], data: word(value), logIndex: index, transactionHash: hash, blockHash, blockNumber: '0x10', removed: false, ...extra });
const receipt = logs => ({ transactionHash: hash, blockHash, blockNumber: '0x10', status: '0x1', gasUsed: '0x5208', effectiveGasPrice: '0x3b9aca00', logs });
const options = { chainId: CHAIN, expectedHash: hash, timestamp: '2026-10-08T00:00:00Z', provider: PROVIDERS[0], observedAt: '2026-10-08T01:00:00Z' };
const decode = logs => decodeReceipt(receipt(logs), options);

test('system18 + ERC206 mirror counts exactly one principal with both sources', () => {
  const r = decode([log(SYSTEM, 1000001000000000000n), log(ERC20, 1000001n, '0x1')]);
  assert.equal(r.payments.length, 1);
  assert.equal(r.payments[0].amount, '1.000001');
  assert.equal(r.payments[0].provenance.logs.length, 2);
  assert.equal(r.fee.amount, '0.000021');
});
test('native sub-micro USDC stays exact and fee never increases principal', () => {
  const r = decode([log(SYSTEM, 1n)]);
  assert.equal(r.payments[0].amount, '0.000000000000000001');
  assert.equal(r.fee.raw_units, '21000000000000');
});
test('identical duplicate events collapse by chain/hash/log index', () => {
  const event = log(SYSTEM, 1n);
  assert.equal(decode([event, event]).payments.length, 1);
});
test('conflicting duplicate identities reject the receipt', () => {
  assert.throws(() => decode([log(SYSTEM, 1n), log(SYSTEM, 2n)]), /conflict/i);
});
test('conflicting log index from unrelated emitter or non-Transfer also rejects', () => {
  assert.throws(() => decode([log(SYSTEM, 1n), log('0x' + '9'.repeat(40), 1n)]), /conflict/i);
  assert.throws(() => decode([log(SYSTEM, 1n), log(SYSTEM, 1n, '0x0', { topics: ['0x' + '9'.repeat(64)] })]), /conflict/i);
});
test('repeated same-tuple system events remain distinct; mirror attribution is ambiguous', () => {
  const r = decode([log(SYSTEM, 1000000000000000000n), log(SYSTEM, 1000000000000000000n, '0x1'), log(ERC20, 1000000n, '0x2')]);
  assert.equal(r.payments.length, 2);
  assert.match(r.warnings.join(' '), /mirror/i);
});
test('ERC20-only and legacy events are unsupported, not independent principal', () => {
  assert.equal(decode([log(ERC20, 1000000n)]).payments.length, 0);
  const r = decode([log('0x1800000000000000000000000000000000000000', 1n)]);
  assert.equal(r.payments.length, 0);
  assert.match(r.warnings.join(' '), /legacy/i);
});
test('mint/burn/self events are excluded from commercial payment candidates', () => {
  const r = decode([log(SYSTEM, 1n, '0x0', { topics: [TRANSFER, addressWord('0x'+'0'.repeat(40)), addressWord(to)] }), log(SYSTEM, 1n, '0x1', { topics: [TRANSFER, addressWord(from), addressWord(from)] })]);
  assert.equal(r.payments.length, 0);
  assert.match(r.warnings.join(' '), /unsupported/i);
});
test('failed and null receipts produce no payable evidence', () => {
  assert.equal(decodeReceipt(null, options).payments.length, 0);
  const r = decodeReceipt({ ...receipt([log(SYSTEM, 1n)]), status: '0x0' }, options);
  assert.equal(r.payments.length, 0);
  assert.equal(r.fee.amount, '0.000021');
});
test('wrong chain/hash, removed logs and malformed known emitters reject', () => {
  assert.throws(() => decodeReceipt(receipt([]), { ...options, chainId: '0x4cef52' }), /chain/i);
  assert.throws(() => decodeReceipt(receipt([]), { ...options, expectedHash: blockHash }), /hash/i);
  assert.throws(() => decode([log(SYSTEM, 1n, '0x0', { removed: true })]));
  assert.throws(() => decode([log(SYSTEM, 1n, '0x0', { data: '0x1' })]));
});
test('observed mainnet evidence has no commercial reference and cannot auto-pay', () => {
  const r = decode([log(SYSTEM, 1000000000000000000n)]);
  const report = reconcile(invoicesFrom([{ invoice_id: 'A', expected_amount: '1' }]), r.payments, allocationsFrom([]));
  assert.equal(report.invoices[0].status, 'unpaid');
  assert.equal(report.payments[0].provenance.kind, 'rpc-observed');
  assert.throws(() => reconcile(invoicesFrom([{ invoice_id: 'A', expected_amount: '1' }]), [...r.payments, ...r.payments], []));
});
const responder = (fn) => async (_url, init) => {
  const request = JSON.parse(init.body);
  return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: fn(request.method, request.params) }), { status: 200 });
};
test('RPC checks chain then receipt/block evidence with bounded calls and timestamps', async () => {
  const calls = [];
  const r = await readTransactions([hash, hash], PROVIDERS[0], { fetcher: responder((method) => {
    calls.push(method);
    if (method === 'eth_chainId') return CHAIN;
    if (method === 'eth_getTransactionReceipt') return receipt([log(SYSTEM, 1n)]);
    return { hash: blockHash, number: '0x10', timestamp: '0x6a000000' };
  }) });
  assert.equal(r.payments.length, 1);
  assert.deepEqual(calls, ['eth_chainId', 'eth_getTransactionReceipt', 'eth_getBlockByHash']);
  assert.ok(r.observations.every(x => x.observed_at && x.provider === PROVIDERS[0]));
});
test('cached block header validates every later receipt height', async () => {
  const otherHash = '0x' + 'c'.repeat(64);
  const r = await readTransactions([hash, otherHash], PROVIDERS[0], { fetcher: responder((method, params) => {
    if (method === 'eth_chainId') return CHAIN;
    if (method === 'eth_getBlockByHash') return { hash: blockHash, number: '0x10', timestamp: '0x6a000000' };
    if (params[0] === hash) return receipt([log(SYSTEM, 1n)]);
    return { ...receipt([log(SYSTEM, 1n, '0x0', { transactionHash: otherHash, blockNumber: '0x99' })]), transactionHash: otherHash, blockNumber: '0x99' };
  }) });
  assert.equal(r.payments.length, 1);
  assert.match(r.warnings.join(' '), /mismatch/);
});
test('wrong-chain RPC stops before any hash receipt is queried', async () => {
  const calls = [];
  await assert.rejects(readTransactions([hash], PROVIDERS[0], { fetcher: responder(method => { calls.push(method); return '0x1'; }) }), /chain/i);
  assert.deepEqual(calls, ['eth_chainId']);
});
test('RPC null/failed receipt is reported without payment', async () => {
  const r = await readTransactions([hash], PROVIDERS[0], { fetcher: responder(method => method === 'eth_chainId' ? CHAIN : null) });
  assert.equal(r.payments.length, 0);
  assert.match(r.warnings.join(' '), /unavailable/i);
});
test('RPC timeout, network and malformed JSON fail gracefully', async () => {
  for (const fetcher of [async () => { throw new Error('network down'); }, async () => new Response('{'), async (_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))]) {
    await assert.rejects(readTransactions([hash], PROVIDERS[0], { fetcher, timeoutMs: 15, retries: 0 }), /RPC|timeout|JSON/i);
  }
});
test('rate limits retry once then terminate; bad hashes/providers/count reject before network', async () => {
  let calls = 0;
  await assert.rejects(readTransactions([hash], PROVIDERS[0], { fetcher: async () => { calls++; return new Response('', { status: 429 }); }, retryDelayMs: 1 }), /429/i);
  assert.equal(calls, 2);
  for (const [hashes, provider] of [[[hash], 'https://evil.example'], [['not-hash'], PROVIDERS[0]], [Array(11).fill(hash), PROVIDERS[0]]]) await assert.rejects(readTransactions(hashes, provider));
});
test('RPC transport blocks 307 redirects without sending the selected hash to another origin', async () => {
  let destinationRequests = 0;
  const destination = createServer((_req, res) => { destinationRequests++; res.end('{}'); });
  const origin = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    const message = JSON.parse(body);
    if (message.method === 'eth_chainId') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result: CHAIN }));
    } else {
      res.writeHead(307, { Location: `http://127.0.0.1:${destination.address().port}/other-origin` }); res.end();
    }
  });
  const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await listen(destination); await listen(origin);
    const r = await readTransactions([hash], PROVIDERS[0], { retries: 0, fetcher: (_url, init) => fetch(`http://127.0.0.1:${origin.address().port}/rpc-fixture`, init) });
    assert.equal(destinationRequests, 0, 'Selected hash must not be forwarded by redirect');
    assert.equal(r.payments.length, 0);
    assert.ok(r.observations.some(x => x.status === 'error'));
  } finally {
    await Promise.all([origin, destination].map(server => new Promise(resolve => server.close(resolve))));
  }
});
