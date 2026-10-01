// Renders the hero at 1200×630 for the Open Graph image.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const T = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((q, s) => { let p = q.url.split('?')[0]; if (p.endsWith('/')) p += 'index.html'; const f = path.join(root, decodeURIComponent(p)); if (!fs.existsSync(f)) { s.writeHead(404); s.end(); return; } s.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(s); });
await new Promise((r) => server.listen(0, r));
const b = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const pg = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await pg.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'networkidle' });
await pg.waitForTimeout(5000);
await pg.addStyleTag({ content: '.hero-lead,.hero-cue,.gauge,.hero-meta{opacity:0!important}' });
await pg.waitForTimeout(300);
await pg.screenshot({ path: path.join(root, 'assets', 'og.png') });
await b.close(); server.close();
console.log('og.png written');
