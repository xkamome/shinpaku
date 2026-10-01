// Drives the interactive pieces and screenshots their states.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out', process.argv[2] || 'interact'); fs.mkdirSync(out, { recursive: true });
const T = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((q, s) => { let p = q.url.split('?')[0]; if (p.endsWith('/')) p += 'index.html'; const f = path.join(root, decodeURIComponent(p)); if (!fs.existsSync(f)) { s.writeHead(404); s.end(); return; } s.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(s); });
await new Promise((r) => server.listen(0, r));
const b = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await pg.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'networkidle' });
await pg.waitForTimeout(3500);
const go = async (sel, off = 0) => { await pg.evaluate(([s, o]) => { const y = document.querySelector(s).getBoundingClientRect().top + window.scrollY + o; window.__shinpaku.lenis.scrollTo(y, { immediate: true, force: true }); }, [sel, off]); await pg.waitForTimeout(1400); };
// grades: slider to 45, then alcohol on
await go('#grades');
await pg.locator('#polish').fill('45'); await pg.waitForTimeout(1200);
await pg.screenshot({ path: path.join(out, 'grades-45.png') });
await pg.click('#alc'); await pg.locator('#polish').fill('72'); await pg.waitForTimeout(1200);
console.log('grades@72+alc:', await pg.textContent('.grades-result'));
await pg.locator('#polish').fill('55'); await pg.waitForTimeout(300);
console.log('grades@55+alc:', await pg.textContent('.grades-result'));
// shape: flat
await go('.shape', -120);
await pg.screenshot({ path: path.join(out, 'shape-sphere.png') });
await pg.click('[data-shape-mode="1"]'); await pg.waitForTimeout(1800);
await pg.screenshot({ path: path.join(out, 'shape-flat.png') });
// meter: preset
await go('#meter', 300);
await pg.click('.presets button:nth-child(3)'); await pg.waitForTimeout(1200);
console.log('meter sweet:', await pg.textContent('.meter-read'));
await pg.screenshot({ path: path.join(out, 'meter-sweet.png') });
// temp: hot
await go('#temp');
await pg.locator('#tempr').fill('8'); await pg.waitForTimeout(1500);
console.log('temp:', await pg.textContent('.temp-read'));
await pg.screenshot({ path: path.join(out, 'temp-hot.png') });
// label hotspot
await go('#label', 200);
await pg.click('[data-term="polish"]'); await pg.waitForTimeout(600);
console.log('label:', await pg.textContent('.lp-term'), '|', await pg.textContent('.lp-desc'));
// types
await go('.block-types', 300);
await pg.click('[data-type="jun"]'); await pg.waitForTimeout(600);
console.log('types:', await pg.textContent('.tp-name'), await pg.textContent('.tp-temp'));
console.log('errors:', errs.length ? errs : 'none');
await b.close(); server.close();
