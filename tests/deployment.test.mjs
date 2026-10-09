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

// Changing a deployable byte, including undeployable files, or adding a dist/
// wrapper must change/fail these checks against the real archive.
test('Pages package is flat-root, sorted, reproducible and checksummed from tested assets', async t => {
  const { access, mkdtemp, mkdir, writeFile, readdir, rm, utimes } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join, dirname } = await import('node:path');
  const { execFileSync } = await import('node:child_process');
  const { createHash } = await import('node:crypto');
  const script = new URL('../scripts/package-pages.mjs', import.meta.url);
  assert.equal(await access(script).then(() => true, () => false), true, 'Pages packaging script must exist');
  const { packagePages } = await import(script.href);
  const workspace = await mkdtemp(join(tmpdir(), 'ledger-pages-test-'));
  t.after(() => rm(workspace, { recursive: true, force: true }));
  const distDir = join(workspace, 'dist');
  const outputDir = join(workspace, 'output');
  const assets = {
    'styles.css': 'body { color: navy; }\n',
    'src/app.js': 'console.log("tested build");\n',
    'index.html': '<!doctype html><title>Tested build</title>\n',
    'demo/payments.json': '[]\n',
    'favicon.ico': 'ico bytes',
    'assets/logo.png': 'logo bytes',
    'assets/favicon-32.png': 'favicon bytes',
    '_headers': '/*\n  X-Content-Type-Options: nosniff\n',
  };
  for (const [name, content] of Object.entries({ ...assets, 'src/app.d.ts': 'export {};', '.env': 'PRIVATE=excluded', 'README.md': 'not a deployable asset', 'assets/logo-source.png': 'source-only image', 'assets/README.md': 'source provenance' })) {
    await mkdir(dirname(join(distDir, name)), { recursive: true });
    await writeFile(join(distDir, name), content);
  }
  const expectedFiles = Object.keys(assets).sort();
  const result = await packagePages({ distDir, outputDir });
  assert.deepEqual(result.files, expectedFiles);
  const zipPath = join(outputDir, 'arc-ledger-match-pages.zip');
  const zip = await readFile(zipPath);
  assert.deepEqual(execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' }).trim().split('\n'), expectedFiles);
  for (const [name, content] of Object.entries(assets)) {
    assert.equal(execFileSync('unzip', ['-p', zipPath, name], { encoding: 'utf8' }), content);
  }
  assert.equal(await readFile(join(outputDir, 'arc-ledger-match-pages.zip.sha256'), 'utf8'), `${createHash('sha256').update(zip).digest('hex')}  arc-ledger-match-pages.zip\n`);
  assert.deepEqual((await readdir(outputDir)).sort(), ['arc-ledger-match-pages.zip', 'arc-ledger-match-pages.zip.sha256']);
  for (const name of expectedFiles) await utimes(join(distDir, name), new Date(), new Date());
  await packagePages({ distDir, outputDir });
  assert.deepEqual(await readFile(zipPath), zip, 'source timestamps must not alter the archive');
  await writeFile(join(distDir, 'src/app.js'), 'console.log("new build");\n');
  await packagePages({ distDir, outputDir });
  assert.notDeepEqual(await readFile(zipPath), zip, 'archive must contain the current tested bytes');
});

test('Pages package refuses symlinked asset directories', async t => {
  const { mkdtemp, mkdir, writeFile, symlink, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { packagePages } = await import('../scripts/package-pages.mjs');
  const workspace = await mkdtemp(join(tmpdir(), 'ledger-pages-link-test-'));
  t.after(() => rm(workspace, { recursive: true, force: true }));
  const distDir = join(workspace, 'dist');
  await mkdir(join(distDir, 'demo'), { recursive: true });
  await mkdir(join(workspace, 'private'));
  await writeFile(join(workspace, 'private', 'app.js'), 'private bytes');
  await symlink(join(workspace, 'private'), join(distDir, 'src'));
  for (const name of ['index.html', 'styles.css', '_headers']) await writeFile(join(distDir, name), name);
  await assert.rejects(packagePages({ distDir, outputDir: join(workspace, 'output') }), /regular directory/);
});

test('CI publishes only validated deployment bytes and successful UI screenshots with read-only permissions', async () => {
  const workflow = await readFile('.github/workflows/ci.yml', 'utf8');
  const ui = workflow.indexOf('run: npm run test:ui');
  const packaging = workflow.indexOf('run: node scripts/package-pages.mjs');
  assert.ok(ui >= 0 && packaging > ui, 'package only after the tested UI build');
  assert.doesNotMatch(workflow.slice(ui), /run:.*(?:npm run build|npm run validate|npm test)/);
  assert.match(workflow, /permissions:\n {2}contents: read\n/);
  assert.doesNotMatch(workflow, /secrets\.|contents: write|id-token: write/);
  assert.equal((workflow.match(/uses: actions\/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9/g) ?? []).length, 3);
  for (const path of ['test-results/pages/arc-ledger-match-pages.zip', 'test-results/pages/arc-ledger-match-pages.zip.sha256', 'test-results/**/*.png']) assert.ok(workflow.includes(path), path);
  assert.equal((workflow.match(/archive: false/g) ?? []).length, 2, 'deployable ZIP and checksum are uploaded unchanged');
  assert.equal((workflow.match(/if-no-files-found: error/g) ?? []).length, 3);
  assert.doesNotMatch(workflow, /if:.*(?:always\(|failure\()/, 'success evidence must not be published after a failed check');
});

// Removing the supplied mark, favicon link, or a copied binary must fail this contract.
test('built brand uses the supplied PNG and linked multi-resolution ICO without duplicate accessible text', async () => {
  const html = await readFile('dist/index.html', 'utf8');
  assert.match(html, /<link rel="icon" type="image\/x-icon" href="favicon\.ico">/);
  assert.match(html, /<link rel="icon" type="image\/png" sizes="32x32" href="assets\/favicon-32\.png">/);
  assert.match(html, /<img class="brand-logo" src="assets\/logo\.png" alt="" width="40" height="40">/);
  assert.doesNotMatch(html, /a↔|class="mark"/);
  for (const name of ['favicon.ico', 'assets/logo.png', 'assets/favicon-32.png']) assert.deepEqual(await readFile(`dist/${name}`), await readFile(name));
  const pngSize = bytes => {
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  };
  assert.deepEqual(pngSize(await readFile('assets/logo.png')), [120, 120]);
  assert.deepEqual(pngSize(await readFile('assets/favicon-32.png')), [32, 32]);
  const { createHash } = await import('node:crypto');
  assert.equal(createHash('sha256').update(await readFile('assets/logo-source.png')).digest('hex'), '160763a7a2b3e91fa10680c5c260462c002a68d1dddc3bbbbbfde9bb9b6ed8e2');
  const ico = await readFile('favicon.ico');
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 4);
  const dimensions = [];
  for (let i = 0; i < 4; i++) {
    const offset = 6 + i * 16;
    const width = ico[offset] || 256, height = ico[offset + 1] || 256;
    dimensions.push(width);
    assert.equal(width, height);
    const length = ico.readUInt32LE(offset + 8), start = ico.readUInt32LE(offset + 12);
    assert.ok(start >= 70 && start + length <= ico.length);
    assert.deepEqual(pngSize(ico.subarray(start, start + length)), [width, height]);
  }
  assert.deepEqual(dimensions, [16, 32, 48, 64]);
});
