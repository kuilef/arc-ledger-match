import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

async function ready(page) {
  await page.goto('/');
  await expect(page.locator('#invoice-body tr')).toHaveCount(8);
}
async function capture(page, name) {
  await mkdir('test-results/screenshots', { recursive: true });
  await page.screenshot({ path: `test-results/screenshots/${name}-viewport.png` });
  // Normalize scroll before full-page capture so fixed/sticky elements do not
  // appear in the middle of a stitched document screenshot.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `test-results/screenshots/${name}.png`, fullPage: true });
}
async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test('result-first desktop, available-payment default, contextual next action and persistent data identity', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await ready(page);
  await expect(page.locator('#dataset-label')).toHaveText('Example data');
  await expect(page.locator('#allocation-payment')).toHaveValue('demo-ambiguous');
  await expect(page.locator('#allocation-invoice')).toHaveValue('INV-CANDIDATE-A');
  await expect(page.locator('#allocation-context')).toContainText('50.00 USDC available');
  await expect(page.locator('#invoice-body tr').first()).toContainText('INV-OVER');
  expect((await page.locator('#invoice-body tr').first().boundingBox()).y).toBeLessThan(650);
  await expect(page.locator('#import-text')).not.toBeVisible();
  await expect(page.locator('#tx-hashes')).not.toBeVisible();
  await noOverflow(page);
  await capture(page, 'desktop-1440');
  await page.getByRole('button', { name: /Review payment/ }).click();
  await expect(page.locator('#allocation-invoice')).toBeFocused();
  await expect(page.locator('#allocation-invoice')).toHaveValue('INV-CANDIDATE-A');
  await page.locator('#allocation-amount').fill('25');
  await page.locator('#allocation-reason').fill('Synthetic customer email confirms part A');
  await page.getByRole('button', { name: /Save allocation/ }).click();
  await expect(page.locator('#allocation-context')).toContainText('25.00 USDC available');
  await expect(page.locator('#dataset-label')).toHaveText('Example + your data');
  // Repeated save updates the existing pair rather than spending the amount twice.
  await page.getByRole('button', { name: /Save allocation/ }).click();
  await expect(page.locator('#allocation-context')).toContainText('25.00 USDC available');
  await expect(page.locator('#invoice-body tr').filter({ hasText: 'INV-CANDIDATE-A' })).toContainText('Partly allocated');
  await capture(page, 'desktop-saved-allocation');
  await page.locator('#import-tools > summary').click();
  await page.locator('#import-text').fill('invoice_id,expected_amount\nOWN,1');
  await page.getByRole('button', { name: 'Import rows' }).click();
  await expect(page.locator('#dataset-label')).toHaveText('Example + your data');
  await page.getByRole('button', { name: 'Clear ledger' }).click();
  await expect(page.locator('#dataset-label')).toHaveText('Empty ledger');
  await expect(page.locator('#save-allocation')).toBeDisabled();
  await page.getByRole('button', { name: 'Import rows' }).click();
  await expect(page.locator('#dataset-label')).toHaveText('Your data');
});

test('mobile 390px remains readable, exact, keyboard reachable, and free of page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await noOverflow(page);
  expect((await page.locator('#invoice-body tr').first().boundingBox()).y).toBeLessThan(820);
  await expect(page.locator('#invoice-body')).toContainText('30.000000000000000001');
  await capture(page, 'mobile-390');
  await page.getByRole('button', { name: /Review payment/ }).click();
  await expect(page.locator('#allocation-invoice')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#allocation-amount')).toBeFocused();
  await page.keyboard.type('25');
  await page.keyboard.press('Tab');
  await page.keyboard.type('Synthetic mobile review');
  await page.keyboard.press('Tab');
  await expect(page.locator('#save-allocation')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#allocation-context')).toContainText('25.00 USDC available');
  await noOverflow(page);
  await capture(page, 'mobile-allocation');
});

test('200 percent zoom-equivalent viewport reflows and primary text/control colors meet AA contrast', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await ready(page);
  // Browser zoom at 200% halves the CSS viewport. Check its reflow equivalent;
  // this is not an OS/browser-chrome zoom automation or a real-device audit.
  await page.setViewportSize({ width: 720, height: 500 });
  await noOverflow(page);
  await expect(page.locator('#dataset-label')).toBeVisible();
  await page.getByRole('button', { name: /Review payment/ }).click();
  await expect(page.locator('#allocation-invoice')).toBeFocused();
  await capture(page, 'zoom-200-reflow-720');
  const ratios = await page.evaluate(() => {
    const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { const c = v / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; });
    const luminance = value => { const [r, g, b] = rgb(value); return .2126 * r + .7152 * g + .0722 * b; };
    return ['body', '.muted', '.primary', '.status.overpaid', '.dataset.has-example'].map(selector => {
      const el = document.querySelector(selector), style = getComputedStyle(el);
      let bg = style.backgroundColor, parent = el.parentElement;
      while (bg === 'rgba(0, 0, 0, 0)' && parent) { bg = getComputedStyle(parent).backgroundColor; parent = parent.parentElement; }
      const a = luminance(style.color), b = luminance(bg);
      return { selector, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
    });
  });
  for (const { selector, ratio } of ratios) expect(ratio, selector).toBeGreaterThanOrEqual(4.5);
});

test('closing and reopening secondary tools keeps entries and does not mutate the ledger', async ({ page }) => {
  await ready(page);
  const before = await page.locator('#full-report').textContent();
  await page.locator('#import-tools > summary').click();
  await page.locator('#import-text').fill('invoice_id,expected_amount\nDRAFT,2');
  await page.locator('#import-tools > summary').click();
  await page.locator('#rpc-tools > summary').click();
  await page.locator('#tx-hashes').fill('bad');
  await page.getByRole('button', { name: 'Read selected hashes' }).click();
  await expect(page.locator('#notice')).toContainText('hash');
  await page.locator('#rpc-tools > summary').click();
  await page.locator('#import-tools > summary').click();
  await expect(page.locator('#import-text')).toHaveValue('invoice_id,expected_amount\nDRAFT,2');
  await expect(page.locator('#full-report')).toHaveText(before);
});


test('reviewing a fully allocated payment selects its associated invoice and exposes source allocations', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: 'Review demo-paid', exact: true }).click();
  await expect(page.locator('#allocation-payment')).toHaveValue('demo-paid');
  await expect(page.locator('#allocation-invoice')).toHaveValue('INV-PAID');
  const row = page.locator('#payment-body tr').filter({ hasText: 'demo-paid' });
  await expect(row.locator('details')).toHaveAttribute('open', '');
  await expect(row.locator('pre')).toContainText('INV-PAID');
});

for (const width of [1440, 390, 320]) {
  test(`About is readable and keyboard reachable without changing the ledger at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    await ready(page);
    const reportBefore = await page.locator('#full-report').textContent();
    const link = page.getByRole('link', { name: 'About', exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '#about');
    await noOverflow(page);
    await link.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#about$/);
    const about = page.locator('#about');
    await expect(about).toBeVisible();
    await expect(about).toBeFocused();
    await expect(about.getByRole('heading', { name: 'About Arc Ledger Match', exact: true })).toBeVisible();
    for (const text of ['freelancers', 'small businesses', 'operations teams', 'partial payments', 'overpayments', 'unassigned amounts', 'cannot identify its invoice', 'browser memory', 'saved automatically', 'before closing or refreshing', 'public transaction hashes', 'chosen RPC provider', 'No wallet connection or signature', 'doesn’t move funds', 'doesn’t certify settlement']) await expect(about).toContainText(text);
    await expect(about.locator('ol > li')).toHaveCount(3);
    expect((await about.boundingBox()).y).toBeGreaterThanOrEqual((await page.locator('.site-header').boundingBox()).height);
    await noOverflow(page);
    await expect(page.locator('#full-report')).toHaveText(reportBefore);
    await mkdir('test-results/screenshots', { recursive: true });
    await page.screenshot({ path: `test-results/screenshots/about-${width}-viewport.png` });
    await about.screenshot({ path: `test-results/screenshots/about-${width}-section.png` });
  });
}

for (const width of [1440, 390, 320]) {
  test(`supplied logo and favicons load with accessible brand and no header overflow at ${width}px`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    await ready(page);
    const brand = page.getByRole('link', { name: 'Arc Ledger Match', exact: true });
    await expect(brand).toBeVisible();
    const logo = brand.locator('img');
    await expect(logo).toHaveAttribute('alt', '');
    await expect(logo).toHaveAttribute('src', 'assets/logo.png');
    expect(await logo.evaluate(img => img.complete && img.naturalWidth === 120 && img.naturalHeight === 120)).toBe(true);
    const box = await logo.boundingBox();
    expect(box.width).toBe(width === 1440 ? 40 : 32);
    expect(box.height).toBe(box.width);
    await expect(page.locator('.mark')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'About', exact: true })).toBeVisible();
    await expect(page.locator('#dataset-label')).toBeVisible();
    const header = await page.locator('.site-header').boundingBox();
    for (const target of [brand, page.locator('.header-right')]) {
      const bounds = await target.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(header.height);
    }
    for (const [path, type] of [['/favicon.ico', 'image/x-icon'], ['/assets/favicon-32.png', 'image/png'], ['/assets/logo.png', 'image/png']]) {
      const response = await request.get(path);
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toBe(type);
      expect((await response.body()).length).toBeGreaterThan(100);
    }
    await expect(page.locator('link[rel="icon"][type="image/x-icon"]')).toHaveAttribute('href', 'favicon.ico');
    await expect(page.locator('link[rel="icon"][type="image/png"]')).toHaveAttribute('href', 'assets/favicon-32.png');
    expect((await request.get('/assets/logo-source.png')).status()).toBe(404);
    await brand.focus();
    await expect(brand).toBeFocused();
    await noOverflow(page);
    await mkdir('test-results/screenshots', { recursive: true });
    await page.screenshot({ path: `test-results/screenshots/logo-${width}-viewport.png` });
    await page.locator('.site-header').screenshot({ path: `test-results/screenshots/logo-${width}-header.png` });
  });
}
