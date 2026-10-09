import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const port = Number(process.env.PORT ?? '5194');
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT must be 1024–65535');
const root = resolve('dist');
const mime = { '.png': 'image/png', '.ico': 'image/x-icon', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.csv': 'text/csv; charset=utf-8' };
const server = createServer(async (req, res) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' https://rpc.mainnet.arc.io https://rpc.drpc.mainnet.arc.io; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    const name = path === '/' ? 'index.html' : path.slice(1);
    if (req.method !== 'GET' || !/^(index\.html|styles\.css|favicon\.ico|assets\/(logo|favicon-32)\.png|src\/[a-z]+\.js|demo\/[a-z-]+\.(json|csv))$/.test(name)) throw new Error('not found');
    const body = await readFile(resolve(root, name));
    res.writeHead(200, { 'Content-Type': mime[extname(name)] ?? 'application/octet-stream' }); res.end(body);
  } catch { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Arc Ledger Match: http://127.0.0.1:${port} (loopback only)`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
