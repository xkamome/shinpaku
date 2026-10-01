// QA harness: serves the site, captures section screenshots (desktop + mobile),
// collects console errors, horizontal overflow and axe-core violations.
// Usage: node check.mjs <round-name>
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const round = process.argv[2] || 'adhoc';
const outDir = path.join(here, 'out', round);
fs.mkdirSync(outDir, { recursive: true });

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const url = `http://127.0.0.1:${server.address().port}/`;

const SHOTS = ['#top', '#surface', '.block-elements', '.block-ferment', '.block-types', '#middle', '#grades', '#process', '#label', '.hiire', '#deep', '#meter', '#polish-shape', '.shape', '.block-rice', '.block-water', '#temp', '#now', '#core', '.site-footer'];

const report = { round, url, runs: [] };

async function run(name, ctxOpts, { shots = true, reduced = false } = {}) {
  const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ ...ctxOpts, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  page.on('requestfailed', (r) => errors.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText}`));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(reduced ? 800 : 5200);

  const info = await page.evaluate(() => ({
    overflowX: document.documentElement.scrollWidth - window.innerWidth,
    docH: document.documentElement.scrollHeight,
    noGL: document.documentElement.classList.contains('no-gl'),
    loaded: document.documentElement.classList.contains('is-loaded'),
    glRenderer: (() => { try { const c = document.createElement('canvas').getContext('webgl'); const d = c.getExtension('WEBGL_debug_renderer_info'); return d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'n/a'; } catch (e) { return 'none'; } })(),
  }));

  info.fps = await page.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(Math.round(n / ((performance.now() - t0) / 1000))); }; requestAnimationFrame(f); }));

  // wide elements that overflow the viewport
  const wide = await page.evaluate(() => {
    const w = window.innerWidth; const out = [];
    document.querySelectorAll('main *, footer *').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && (r.right > w + 1 || r.left < -1) && getComputedStyle(el).position !== 'fixed' && !el.closest('.marquee') && !el.closest('.process')) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} [${Math.round(r.left)}, ${Math.round(r.right)}]`);
    });
    return out.slice(0, 12);
  });

  const shotsTaken = [];
  if (shots) {
    let i = 0;
    for (const sel of SHOTS) {
      const y = await page.evaluate((s) => {
        const el = document.querySelector(s);
        if (!el) return null;
        return el.getBoundingClientRect().top + window.scrollY;
      }, sel);
      if (y == null) continue;
      await page.evaluate((yy) => {
        const L = window.__shinpaku && window.__shinpaku.lenis;
        if (L) L.scrollTo(yy, { immediate: true, force: true }); else window.scrollTo(0, yy);
      }, Math.max(0, y - (sel === '#core' ? 0 : 0)));
      await page.waitForTimeout(1500);
      const file = `${name}-${String(++i).padStart(2, '0')}-${sel.replace(/[^a-z0-9]+/gi, '')}.png`;
      await page.screenshot({ path: path.join(outDir, file) });
      shotsTaken.push(file);
      if (sel === '#process' && name.startsWith('desktop')) {
        for (const extra of [0.5, 1.0]) {
          await page.evaluate((f) => {
            const L = window.__shinpaku.lenis; const st = window.ScrollTrigger.getAll().find((t) => t.pin);
            if (st && L) L.scrollTo(st.start + (st.end - st.start) * f, { immediate: true, force: true });
          }, extra);
          await page.waitForTimeout(1500);
          const f2 = `${name}-${String(i).padStart(2, '0')}b-process-${extra}.png`;
          await page.screenshot({ path: path.join(outDir, f2) });
          shotsTaken.push(f2);
        }
      }
    }
  }

  let axe = null;
  try {
    const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    axe = res.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
  } catch (e) { axe = [{ id: 'axe-failed', impact: 'n/a', n: 0, sample: [String(e)] }]; }

  report.runs.push({ name, ...info, wide, errors, axe, shots: shotsTaken });
  await browser.close();
}

await run('desktop', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await run('mobile', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await run('reduced', { viewport: { width: 1280, height: 800 } }, { shots: false, reduced: true });

server.close();
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));

// console summary
for (const r of report.runs) {
  const serious = (r.axe || []).filter((v) => v.impact === 'serious' || v.impact === 'critical');
  console.log(`\n== ${r.name}  overflowX=${r.overflowX} noGL=${r.noGL} loaded=${r.loaded} gl=${r.glRenderer}`);
  console.log(`   errors: ${r.errors.length}${r.errors.length ? '\n   - ' + r.errors.slice(0, 8).join('\n   - ') : ''}`);
  console.log(`   wide: ${r.wide.length ? r.wide.join(' | ') : 'none'}`);
  console.log(`   axe: ${(r.axe || []).map((v) => `${v.id}(${v.impact}×${v.n})`).join(', ') || 'clean'}`);
  if (serious.length) serious.forEach((v) => console.log(`     ! ${v.id}: ${v.sample.join(' ; ')}`));
}
const failed = report.runs.some((r) => r.errors.some((e) => e.includes('error')) || r.overflowX > 0 || (r.axe || []).some((v) => v.impact === 'critical' || v.impact === 'serious'));
console.log(`\nRESULT: ${failed ? 'FAIL' : 'PASS'}  →  ${outDir}`);
process.exit(failed ? 1 : 0);
