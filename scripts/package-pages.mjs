import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, copyFile, lstat, mkdir, mkdtemp, readdir, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const archiveName = 'arc-ledger-match-pages.zip';
const fixedTime = new Date('1980-01-01T00:00:00.000Z');
// Match the public site's assets, never source declarations or incidental files.
const deployable = /^(index\.html|styles\.css|_headers|src\/[a-z]+\.js|demo\/[a-z-]+\.(json|csv))$/;

export async function packagePages({ distDir = 'dist', outputDir = 'test-results/pages' } = {}) {
  const files = [];
  for (const directory of ['', 'src', 'demo']) {
    const directoryPath = join(distDir, directory);
    if (!(await lstat(directoryPath)).isDirectory()) throw new Error(`Asset path must be a regular directory: ${directoryPath}`);
    for (const entry of await readdir(directoryPath, { withFileTypes: true })) {
      const name = directory ? `${directory}/${entry.name}` : entry.name;
      if (!deployable.test(name)) continue;
      if (!entry.isFile()) throw new Error(`Deployable asset must be a regular file: ${name}`);
      files.push(name);
    }
  }
  files.sort();
  for (const required of ['index.html', 'styles.css', '_headers', 'src/app.js']) {
    if (!files.includes(required)) throw new Error(`Missing deployable asset: ${required}`);
  }

  const staging = await mkdtemp(join(tmpdir(), 'ledger-pages-'));
  try {
    const publicRoot = join(staging, 'public');
    for (const name of files) {
      const target = join(publicRoot, name);
      await mkdir(dirname(target), { recursive: true });
      await copyFile(join(distDir, name), target);
      await chmod(target, 0o644);
      await utimes(target, fixedTime, fixedTime);
    }
    // Sorted input, fixed timestamps/modes and -X make identical bytes reproducible.
    // cwd is the public root, so index.html is at the ZIP root (no dist/ wrapper).
    const stagedArchive = join(staging, archiveName);
    execFileSync('zip', ['-X', '-q', stagedArchive, '-@'], {
      cwd: publicRoot,
      input: `${files.join('\n')}\n`,
      env: { ...process.env, TZ: 'UTC' },
    });
    const archive = await readFile(stagedArchive);
    const sha256 = createHash('sha256').update(archive).digest('hex');
    await mkdir(outputDir, { recursive: true });
    const archivePath = join(outputDir, archiveName);
    const checksumPath = `${archivePath}.sha256`;
    await writeFile(archivePath, archive);
    await writeFile(checksumPath, `${sha256}  ${archiveName}\n`);
    return { files, archivePath, checksumPath, sha256 };
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await packagePages();
  console.log(`Packaged ${result.files.length} tested assets:\n${result.files.join('\n')}`);
  console.log(`${result.archivePath}\nSHA256 ${result.sha256}`);
}
