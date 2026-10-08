export const PROVIDERS = ['https://rpc.mainnet.arc.io', 'https://rpc.drpc.mainnet.arc.io'] as const;
import { CHAIN, decodeReceipt, hash32, quantity } from './arc.js';
import type { Fee } from './arc.js';
import { record, unique } from './domain.js';
import type { Payment } from './domain.js';
export interface Observation { provider: string; observed_at: string; method: string; params: unknown[]; status: 'ok' | 'error'; result?: unknown; error?: string }
export interface RpcResult { payments: Payment[]; fees: Fee[]; warnings: string[]; observations: Observation[] }
export interface RpcOptions { fetcher?: typeof fetch; timeoutMs?: number; retries?: 0 | 1; retryDelayMs?: number }
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
export async function readTransactions(hashes: string[], provider: string, options: RpcOptions = {}): Promise<RpcResult> {
  if (!PROVIDERS.some(x => x === provider)) throw new Error('Choose an allowlisted anonymous mainnet RPC provider');
  if (!Array.isArray(hashes) || hashes.length < 1 || hashes.length > 10) throw new Error('Select 1–10 public transaction hashes');
  const selected = [...new Set(hashes.map(hash32))];
  const timeout = options.timeoutMs ?? 8000, retries = options.retries ?? 1, delay = options.retryDelayMs ?? 400;
  if (!Number.isInteger(timeout) || timeout < 10 || timeout > 15000 || ![0, 1].includes(retries) || delay < 0 || delay > 2000) throw new Error('Invalid bounded RPC options');
  const result: RpcResult = { payments: [], fees: [], warnings: [], observations: [] };
  const fetcher = options.fetcher ?? fetch; let id = 0;
  const rpc = async (method: string, params: unknown[]): Promise<unknown> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeout);
      const requestId = ++id, observedAt = new Date().toISOString();
      let retryable = false;
      try {
        const response = await fetcher(provider, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: requestId, method, params }), signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
        if (!response.ok) { retryable = response.status === 429 || response.status === 503; throw new Error(`RPC HTTP ${response.status}`); }
        if (Number(response.headers.get('content-length') ?? 0) > 2_000_000) throw new Error('RPC response exceeds 2 MB');
        const reader = response.body?.getReader(); const chunks: Uint8Array[] = []; let size = 0;
        if (reader) {
          while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 2_000_000) { await reader.cancel(); throw new Error('RPC response exceeds 2 MB'); } chunks.push(value); }
        }
        const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        let data: unknown; try { data = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Error('RPC invalid JSON response'); }
        const envelope = record(data, 'RPC response');
        if (envelope.jsonrpc !== '2.0' || envelope.id !== requestId) throw new Error('RPC response identity mismatch');
        if (envelope.error !== undefined) { const error = record(envelope.error, 'RPC error'); retryable = error.code === -32014 || error.code === -32005; throw new Error(`RPC error ${String(error.code)}`); }
        if (!Object.hasOwn(envelope, 'result')) throw new Error('RPC missing result');
        result.observations.push({ provider, observed_at: observedAt, method, params, status: 'ok', result: envelope.result });
        return envelope.result;
      } catch (error) {
        const message = controller.signal.aborted ? `RPC timeout after ${timeout}ms` : `RPC: ${error instanceof Error ? error.message : 'request failed'}`;
        result.observations.push({ provider, observed_at: observedAt, method, params, status: 'error', error: message });
        if (!retryable || attempt === retries) throw new Error(message, { cause: error });
      } finally { clearTimeout(timer); }
      await sleep(delay);
    }
    throw new Error('RPC retry exhausted');
  };
  const chain = await rpc('eth_chainId', []);
  if (quantity(chain) !== quantity(CHAIN)) throw new Error('Wrong RPC chain; Arc mainnet 5042 required');
  const blocks = new Map<string, { number: bigint; timestamp: string }>();
  for (const hash of selected) {
    try {
      const receipt = await rpc('eth_getTransactionReceipt', [hash]);
      let timestamp = new Date().toISOString();
      if (receipt !== null) {
        const row = record(receipt, 'receipt'), blockHash = hash32(row.blockHash);
        if (quantity(row.status) === 1n) {
          if (!blocks.has(blockHash)) {
            const block = record(await rpc('eth_getBlockByHash', [blockHash, false]), 'block');
            if (hash32(block.hash) !== blockHash || quantity(block.number) !== quantity(row.blockNumber)) throw new Error('RPC block/receipt mismatch');
            const seconds = quantity(block.timestamp);
            if (seconds > 253402300799n) throw new Error('RPC timestamp out of range');
            blocks.set(blockHash, { number: quantity(block.number), timestamp: new Date(Number(seconds) * 1000).toISOString() });
          }
          const cached = blocks.get(blockHash)!;
          if (cached.number !== quantity(row.blockNumber)) throw new Error('RPC cached block/receipt mismatch');
          timestamp = cached.timestamp;
        }
      }
      const decoded = decodeReceipt(receipt, { chainId: CHAIN, expectedHash: hash, timestamp, provider, observedAt: new Date().toISOString() });
      result.payments.push(...decoded.payments); if (decoded.fee) result.fees.push(decoded.fee);
      result.warnings.push(...decoded.warnings.map(x => `${hash}: ${x}`));
    } catch (error) { result.warnings.push(`${hash}: ${error instanceof Error ? error.message : 'Unsupported evidence'}; no payment imported for this hash`); }
  }
  unique(result.payments, x => x.payment_id);
  return result;
}
