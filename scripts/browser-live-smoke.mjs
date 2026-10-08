import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const network = [], messages = [];
page.on('requestfailed', r => network.push({ url: r.url(), error: r.failure()?.errorText }));
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') messages.push(m.text()); });
const evidence = { checked_at: new Date().toISOString(), browser: 'installed Chrome, temporary headless profile', local_url: 'http://127.0.0.1:5194', public_hash: '0x691405ed18faaf588878725c5df92a338cad75fdec5b1f38250d9073ae7ad9c4', attempts: [] };
try {
  await page.goto(evidence.local_url);
  await page.locator('#dataset-label').filter({ hasText: 'Synthetic demo' }).waitFor();
  await page.screenshot({ path: 'evidence/browser-demo.png', fullPage: true });
  await page.locator('#tx-hashes').fill(evidence.public_hash);
  for (const provider of ['https://rpc.mainnet.arc.io', 'https://rpc.drpc.mainnet.arc.io']) {
    await page.locator('#rpc-provider').selectOption(provider);
    await page.getByRole('button', { name: 'Read selected hashes' }).click();
    await page.getByRole('button', { name: 'Read selected hashes', exact: true }).waitFor({ timeout: 60000 });
    const notice = await page.locator('#notice').innerText();
    evidence.attempts.push({ provider, observed_at: new Date().toISOString(), notice, evidence_text: await page.locator('#rpc-evidence').textContent() });
  }
  evidence.outcome = evidence.attempts.some(x => /[1-9]\d* observed transfer/.test(x.notice)) ? 'browser-mainnet-transfer-observed' : 'browser-mainnet-read-failed';
} catch (error) { evidence.outcome = 'browser-smoke-failed'; evidence.error = error.message; }
finally { evidence.request_failures = network; evidence.console_errors = messages; await browser.close(); }
await writeFile('evidence/browser-live.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({ outcome: evidence.outcome, attempts: evidence.attempts.map(x => ({ provider: x.provider, notice: x.notice })), request_failures: network }, null, 2));
