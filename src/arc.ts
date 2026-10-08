export const SYSTEM = '0xfffffffffffffffffffffffffffffffffffffffe';
export const ERC20 = '0x3600000000000000000000000000000000000000';
export const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
export const CHAIN = '0x13b2';
import { address, formatAmount, isoDate, record, stringField } from './domain.js';
import type { LogEvidence, Payment } from './domain.js';
export interface ReceiptOptions { chainId: string; expectedHash: string; timestamp: string; provider: string; observedAt: string }
export interface Fee { tx_hash: string; amount: string; raw_units: string; decimals: 18; explanation: string }
export interface Decoded { payments: Payment[]; fee: Fee | null; warnings: string[] }
export function hash32(value: unknown): string {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error('Invalid 32-byte hash');
  return value.toLowerCase();
}
export function quantity(value: unknown): bigint {
  if (typeof value !== 'string' || value.length > 66 || !/^0x(0|[1-9a-fA-F][0-9a-fA-F]*)$/.test(value)) throw new Error('Invalid RPC hex quantity');
  return BigInt(value);
}
interface Event { from: string; to: string; raw: bigint; amount: bigint; evidence: LogEvidence }
export function decodeReceipt(input: unknown, options: ReceiptOptions): Decoded {
  if (quantity(options.chainId) !== 5042n) throw new Error('Wrong chain: Arc mainnet 5042 required');
  const txHash = hash32(options.expectedHash), warnings: string[] = [];
  if (input === null) return { payments: [], fee: null, warnings: ['Receipt unavailable (pending, unknown hash, or provider lag)'] };
  const receipt = record(input, 'receipt');
  if (hash32(receipt.transactionHash) !== txHash) throw new Error('Receipt transaction hash mismatch');
  const blockHash = hash32(receipt.blockHash), blockNumber = quantity(receipt.blockNumber).toString();
  const status = quantity(receipt.status);
  if (status !== 0n && status !== 1n) throw new Error('Unsupported receipt status');
  let fee: Fee | null = null;
  if (receipt.gasUsed !== undefined && receipt.effectiveGasPrice !== undefined) {
    const units = quantity(receipt.gasUsed) * quantity(receipt.effectiveGasPrice);
    fee = { tx_hash: txHash, amount: formatAmount(units), raw_units: units.toString(), decimals: 18, explanation: 'Transaction gasUsed × effectiveGasPrice, separate from transfer principal; not an invoice allocation' };
  } else warnings.push('Gas fee unavailable: missing gasUsed/effectiveGasPrice');
  if (status === 0n) return { payments: [], fee, warnings: [...warnings, 'Transaction failed; no payable evidence'] };
  const occurredAt = isoDate(options.timestamp), observedAt = isoDate(options.observedAt);
  if (!Array.isArray(receipt.logs) || receipt.logs.length > 1000) throw new Error('Invalid/bounded receipt log array');
  const native: Event[] = [], erc: Event[] = [], seen = new Map<string, string>();
  for (const rawLog of receipt.logs) {
    const log = record(rawLog, 'log'), emitter = address(log.address);
    if (!Array.isArray(log.topics) || log.topics.length > 4) throw new Error('Malformed log topics');
    const topics = log.topics.map(hash32);
    if (typeof log.data !== 'string' || log.data.length > 100_000 || !/^0x([0-9a-fA-F]{2})*$/.test(log.data)) throw new Error('Malformed/bounded log data');
    if (log.removed !== false && log.removed !== undefined) throw new Error('Removed log is not payable evidence');
    if (hash32(log.transactionHash) !== txHash || hash32(log.blockHash) !== blockHash || quantity(log.blockNumber).toString() !== blockNumber) throw new Error('Log/receipt evidence mismatch');
    const logIndex = quantity(log.logIndex).toString();
    const identity = JSON.stringify([emitter, topics, log.data.toLowerCase()]);
    const previous = seen.get(logIndex);
    if (previous !== undefined) {
      if (previous !== identity) throw new Error('Conflicting duplicate log identity');
      warnings.push(`Collapsed duplicate event at log ${logIndex}`); continue;
    }
    seen.set(logIndex, identity);
    if (emitter === '0x1800000000000000000000000000000000000000') { warnings.push('Legacy testnet emitter unsupported; not mainnet payment evidence'); continue; }
    if (emitter !== SYSTEM && emitter !== ERC20) continue;
    if (topics[0] !== TRANSFER) continue;
    if (topics.length !== 3) throw new Error('Malformed Transfer topics');
    const topicAddress = (value: unknown) => {
      const word = hash32(value);
      if (!/^0x0{24}/.test(word)) throw new Error('Noncanonical address topic');
      return address(`0x${word.slice(-40)}`);
    };
    const from = topicAddress(topics[1]), to = topicAddress(topics[2]);
    const raw = BigInt(hash32(log.data));
    if (raw === 0n || from === to || from === '0x' + '0'.repeat(40) || to === '0x' + '0'.repeat(40)) { warnings.push(`Unsupported mint/burn/self/zero event at log ${logIndex}`); continue; }
    const decimals = emitter === SYSTEM ? 18 : 6;
    const event: Event = { from, to, raw, amount: decimals === 18 ? raw : raw * 10n ** 12n, evidence: { emitter, log_index: logIndex, raw_units: raw.toString(), decimals } };
    (emitter === SYSTEM ? native : erc).push(event);
  }
  const same = (a: Event, b: Event) => a.from === b.from && a.to === b.to && a.amount === b.amount;
  const payments = native.map(event => {
    const mirrors = erc.filter(e => same(event, e)), matchingNatives = native.filter(e => same(event, e));
    const logs = [event.evidence];
    if (mirrors.length === 1 && matchingNatives.length === 1) logs.push(mirrors[0]!.evidence);
    else if (mirrors.length) warnings.push(`Ambiguous mirror association at system log ${event.evidence.log_index}; only system principal counted`);
    return {
      payment_id: `arc:5042:${txHash}:${event.evidence.log_index}`, amount: formatAmount(event.amount), sender: event.from, receiver: event.to, occurred_at: occurredAt,
      provenance: { kind: 'rpc-observed' as const, label: 'Successful Arc mainnet system Transfer observed via RPC; commercial purpose unproven', provider: stringField(options.provider, 'provider'), observed_at: observedAt, tx_hash: txHash, block_hash: blockHash, block_number: blockNumber, logs },
    };
  });
  for (const event of erc) if (!native.some(e => same(e, event))) warnings.push(`Unsupported ERC20-only/mismatched event at log ${event.evidence.log_index}; principal excluded`);
  return { payments, fee, warnings };
}
