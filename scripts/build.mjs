import { cp, mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
for (const name of ['index.html', 'styles.css']) await copyFile(name, `dist/${name}`);
await cp('demo', 'dist/demo', { recursive: true });
