// Static checks run in CI: local references resolve, scripts parse, nothing machine-specific leaks.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = ['assets/css/main.css', 'assets/css/fonts.css'].map((f) => [f, fs.readFileSync(path.join(root, f), 'utf8')]);

for (const m of html.matchAll(/(?:src|href)="([^"#:]+)"/g)) {
  if (!fs.existsSync(path.join(root, m[1]))) problems.push(`index.html → missing ${m[1]}`);
}
for (const [f, text] of css) {
  for (const m of text.matchAll(/url\(\s*['"]?(?!data:)([^)'"]+)['"]?\s*\)/g)) {
    const ref = m[1];
    if (ref.startsWith('%23') || ref.startsWith('#')) continue; // fragment refs inside inline SVG data URIs
    if (!fs.existsSync(path.join(root, path.dirname(f), ref))) problems.push(`${f} → missing ${ref}`);
  }
}
for (const f of fs.readdirSync(path.join(root, 'assets/js'))) {
  try { execFileSync(process.execPath, ['--check', path.join(root, 'assets/js', f)], { stdio: 'pipe' }); }
  catch (e) { problems.push(`assets/js/${f} → ${String(e.stderr).split('\n')[0]}`); }
}
const leak = /localhost|127\.0\.0\.1|C:\\Users|\/Users\//;
for (const f of ['index.html', 'assets/js/main.js', 'assets/js/scene.js', 'assets/js/interactives.js', 'assets/css/main.css']) {
  if (leak.test(fs.readFileSync(path.join(root, f), 'utf8'))) problems.push(`${f} → contains a machine-specific path`);
}
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
ids.filter((id, i) => ids.indexOf(id) !== i).forEach((id) => problems.push(`duplicate id #${id}`));

if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log(`verify: ok (${ids.length} ids, ${fs.readdirSync(path.join(root, 'assets/fonts')).length} font files)`);
