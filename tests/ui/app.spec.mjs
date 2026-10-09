import { test, expect } from '@playwright/test';

async function openTools(page) {
  for (const id of ['import-tools', 'rpc-tools']) {
    if (!(await page.locator(`#${id}`).evaluate(node => node.open))) await page.locator(`#${id} > summary`).click();
  }
}
test('synthetic demo, evidence, ambiguity and exact split report', async ({ page }) => {
  const external = [];
  page.on('request', req => { if (!req.url().startsWith('http://127.0.0.1:5194')) external.push(req.url()); });
  await page.goto('/'); await openTools(page);
  await expect(page.locator('#invoice-body tr')).toHaveCount(8);
  await expect(page.locator('#invoice-body tr').filter({ hasText: 'INV-PARTIAL' })).toContainText('Partly allocated');
  await expect(page.locator('#invoice-body tr').filter({ hasText: 'INV-OVER' })).toContainText('Overallocated');
  await expect(page.locator('#payment-body tr').filter({ hasText: 'demo-ambiguous' })).toContainText('Needs a decision');
  await page.locator('#allocation-payment').selectOption('demo-ambiguous');
  await page.locator('#allocation-invoice').selectOption('INV-CANDIDATE-A');
  await page.locator('#allocation-amount').fill('25');
  await page.locator('#allocation-reason').fill('Customer confirmed half by email; synthetic example');
  await page.getByRole('button', { name: /Save allocation/ }).click();
  await expect(page.locator('#invoice-body tr').filter({ hasText: 'INV-CANDIDATE-A' })).toContainText('Partly allocated');
  await page.locator('#allocation-invoice').selectOption('INV-CANDIDATE-B');
  await page.locator('#allocation-amount').fill('26');
  await page.getByRole('button', { name: /Save allocation/ }).click();
  await expect(page.locator('#notice')).toContainText('exceeds payment principal');
  await expect(page.locator('#invoice-body tr').filter({ hasText: 'INV-CANDIDATE-B' })).toContainText('Unallocated');
  await page.locator('#allocation-amount').fill('25');
  await page.getByRole('button', { name: /Save allocation/ }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export report JSON/ }).click();
  expect((await download).suggestedFilename()).toBe('arc-ledger-report.json');
  expect(external).toEqual([]);
});
test('invalid import is atomic and markup is rendered as text', async ({ page }) => {
  await page.goto('/'); await openTools(page); await expect(page.locator('#invoice-body tr')).toHaveCount(8);
  await page.locator('#import-kind').selectOption('invoices');
  await page.locator('#import-format').selectOption('csv');
  await page.locator('#import-text').fill('invoice_id,expected_amount\nA,not-an-amount');
  await page.getByRole('button', { name: 'Import rows' }).click();
  await expect(page.locator('#notice')).toContainText('exact decimal');
  await expect(page.locator('#invoice-body tr')).toHaveCount(8);
  await page.getByRole('button', { name: 'Clear ledger' }).click();
  await page.locator('#import-text').fill('invoice_id,expected_amount\n<img src=x onerror=alert(1)>,1');
  await page.getByRole('button', { name: 'Import rows' }).click();
  await expect(page.locator('#invoice-body')).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('#invoice-body img')).toHaveCount(0);
});
test('unknown hash fails visibly and local server denies private paths', async ({ page, request }) => {
  await page.goto('/'); await openTools(page); await page.locator('#tx-hashes').fill('bad');
  await page.getByRole('button', { name: 'Read selected hashes' }).click();
  await expect(page.locator('#notice')).toContainText('hash');
  expect((await request.get('/.env')).status()).toBe(404);
  expect((await request.get('/src/domain.js')).headers()['content-security-policy']).toContain("script-src 'self'");
});
test('repeat RPC evidence never duplicates principal and unavailable reread revokes old allocation', async ({ page }) => {
  const hash = '0x' + 'a'.repeat(64), blockHash = '0x' + 'b'.repeat(64);
  let receipts = 0;
  await page.route('https://rpc.mainnet.arc.io/', async route => {
    const r = route.request().postDataJSON(); let result;
    expect(JSON.stringify(r)).not.toContain('PRIVATE-INVOICE');
    if (r.method === 'eth_chainId') result = '0x13b2';
    else if (r.method === 'eth_getBlockByHash') result = { hash: blockHash, number: '0x10', timestamp: '0x6a000000' };
    else {
      receipts++;
      result = receipts <= 2 ? { transactionHash: hash, blockHash, blockNumber: '0x10', status: '0x1', gasUsed: '0x5208', effectiveGasPrice: '0x1', logs: [{ address: '0xfffffffffffffffffffffffffffffffffffffffe', topics: ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', '0x' + '0'.repeat(24) + '1'.repeat(40), '0x' + '0'.repeat(24) + '2'.repeat(40)], data: '0x' + (10n ** 18n).toString(16).padStart(64, '0'), logIndex: '0x0', transactionHash: hash, blockHash, blockNumber: '0x10' }] } : null;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ jsonrpc: '2.0', id: r.id, result }) });
  });
  await page.goto('/'); await openTools(page); await expect(page.locator('#invoice-body tr')).toHaveCount(8);
  await page.getByRole('button', { name: 'Clear ledger' }).click();
  await page.locator('#import-text').fill('invoice_id,expected_amount\nPRIVATE-INVOICE,1');
  await page.getByRole('button', { name: 'Import rows' }).click();
  await page.locator('#tx-hashes').fill(hash);
  for (let n = 0; n < 2; n++) {
    await page.getByRole('button', { name: 'Read selected hashes' }).click();
    await expect(page.locator('#notice')).toContainText('1 observed transfer');
    await expect(page.locator('#payment-body tr')).toHaveCount(1);
  }
  await page.locator('#allocation-amount').fill('1'); await page.locator('#allocation-reason').fill('local invoice ledger reference');
  await page.getByRole('button', { name: /Save allocation/ }).click();
  await expect(page.locator('#invoice-body .status')).toHaveText('Fully allocated');
  await page.getByRole('button', { name: 'Read selected hashes' }).click();
  await expect(page.locator('#notice')).toContainText('0 observed transfer');
  await expect(page.locator('#invoice-body .status')).toHaveText('Unallocated');
});
for (const intent of ['clear', 'import', 'read']) {
  test(`delayed demo cannot overwrite a subsequent ${intent}`, async ({ page }) => {
    const held = [];
    await page.route('**/demo/*.json', route => { held.push(route); });
    await page.route('https://rpc.mainnet.arc.io/', async route => {
      const request = route.request().postDataJSON();
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ jsonrpc: '2.0', id: request.id, result: request.method === 'eth_chainId' ? '0x13b2' : null }) });
    });
    await page.goto('/'); await openTools(page); await expect.poll(() => held.length).toBe(3);
    if (intent === 'clear') await page.getByRole('button', { name: 'Clear ledger' }).click();
    else if (intent === 'import') {
      await page.locator('#import-text').fill('invoice_id,expected_amount\nLOCAL-ROW,1');
      await page.getByRole('button', { name: 'Import rows' }).click();
    } else {
      await page.locator('#tx-hashes').fill('0x' + 'a'.repeat(64));
      await page.getByRole('button', { name: 'Read selected hashes' }).click();
      await expect(page.locator('#rpc-count')).toContainText('(2 requests)');
    }
    await Promise.all(held.map(route => route.continue()));
    await page.waitForLoadState('networkidle');
    if (intent === 'import') {
      await expect(page.locator('#invoice-body tr')).toHaveCount(1);
      await expect(page.locator('#invoice-body')).toContainText('LOCAL-ROW');
    } else await expect(page.locator('#invoice-body')).toContainText('No invoices.');
    if (intent === 'read') await expect(page.locator('#rpc-count')).toContainText('(2 requests)');
  });
}
test('candidate budget rejection preserves the entire ledger and prior RPC evidence', async ({ page }) => {
  await page.route('https://rpc.mainnet.arc.io/', async route => {
    const request = route.request().postDataJSON();
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ jsonrpc: '2.0', id: request.id, result: request.method === 'eth_chainId' ? '0x13b2' : null }) });
  });
  await page.goto('/'); await openTools(page); await expect(page.locator('#invoice-body tr')).toHaveCount(8);
  await page.locator('#tx-hashes').fill('0x' + 'a'.repeat(64));
  await page.getByRole('button', { name: 'Read selected hashes' }).click();
  await expect(page.locator('#rpc-count')).toContainText('(2 requests)');
  await page.locator('#import-format').selectOption('json');
  await page.locator('#import-text').fill(JSON.stringify(Array.from({ length: 71 }, (_, n) => ({ invoice_id: `I${n}`, expected_amount: '1' }))));
  await page.getByRole('button', { name: 'Import rows' }).click();
  await expect(page.locator('#invoice-body tr')).toHaveCount(71);
  const before = await page.locator('#full-report').textContent();
  await page.locator('#import-kind').selectOption('payments');
  await page.locator('#import-text').fill(JSON.stringify(Array.from({ length: 71 }, (_, n) => ({ payment_id: `P${n}`, amount: '1' }))));
  await page.getByRole('button', { name: 'Import rows' }).click();
  await expect(page.locator('#notice')).toContainText('Candidate link budget exceeded (5000 total links)');
  await expect(page.locator('#full-report')).toHaveText(before);
  await expect(page.locator('#rpc-count')).toContainText('(2 requests)');
});
