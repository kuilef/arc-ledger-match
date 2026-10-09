import { cp, mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
for (const name of ['index.html', 'styles.css', '_headers', 'favicon.ico']) await copyFile(name, `dist/${name}`);
await cp('demo', 'dist/demo', { recursive: true });
await mkdir('dist/assets', { recursive: true });
for (const name of ['logo.png', 'favicon-32.png']) await copyFile(`assets/${name}`, `dist/assets/${name}`);
