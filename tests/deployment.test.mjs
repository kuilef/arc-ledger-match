import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('public build retains restrictive headers and only fixed RPC origins', async () => {
  const headers = await readFile('dist/_headers', 'utf8');
  assert.match(headers, /^\/\*\n/);
  for (const value of [
    "script-src 'self'", "object-src 'none'", "frame-ancestors 'none'",
    'X-Content-Type-Options: nosniff', 'Referrer-Policy: no-referrer',
    'Cache-Control: no-store', 'X-Frame-Options: DENY',
  ]) assert.ok(headers.includes(value), value);
  const connect = headers.match(/connect-src ([^;]+);/)[1];
  assert.equal(connect, "'self' https://rpc.mainnet.arc.io https://rpc.drpc.mainnet.arc.io");
  assert.equal(headers, await readFile('_headers', 'utf8'));
  const config = JSON.parse(await readFile('wrangler.json', 'utf8'));
  assert.equal(config.assets.directory, './dist');
  assert.equal(config.workers_dev, true);
  assert.equal(config.main, undefined);
});
