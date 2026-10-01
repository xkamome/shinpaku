// Interactive pieces. Each init function is independent and degrades to static content.

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

export const state = {
  gradePolish: 0.6,   // fed to the rice grain while the grades block is in view
  flat: 0,            // 0 spherical, 1 flat milling
  temp: 0,            // -1 cold .. 1 hot
};

function setFill(input) {
  const min = +input.min, max = +input.max, v = +input.value;
  input.style.setProperty('--fill', `${((v - min) / (max - min)) * 100}%`);
}

/* ───────── 1-3 four types ───────── */
const TYPES = {
  kun: { k: '香高・味淡', name: '薫酒', desc: '像花和水果一樣華麗的香氣，口感輕盈。多半是用心磨米、低溫發酵的酒。', ex: '大吟釀、吟釀', temp: '10–15℃（花冷え～涼冷え）', food: '白肉魚生魚片、清蒸料理、水果前菜' },
  juku: { k: '香高・味濃', name: '熟酒', desc: '長期熟成帶來焦糖、乾果和香料般的複雜香氣，顏色偏琥珀。', ex: '長期熟成酒、古酒', temp: '常溫，或稍微溫熱', food: '紅燒、滷味、藍紋起司、乾果' },
  sou: { k: '香低・味淡', name: '爽酒', desc: '清爽俐落、香氣低調，最不挑料理。冰鎮後特別好入口。', ex: '生酒、本釀造、清爽型普通酒', temp: '5–10℃（雪冷え～花冷え）', food: '生蠔、涼拌菜、鹽烤' },
  jun: { k: '香低・味濃', name: '醇酒', desc: '米的鮮味和甜味都很飽滿，溫熱後更出色。', ex: '純米酒、生酛・山廢', temp: '常溫～45℃（上燗）', food: '燉煮、烤魚、醬燒料理' },
};

export function initTypes() {
  const map = $('.types-map');
  if (!map) return;
  const panel = $('.types-panel');
  const show = (key) => {
    const d = TYPES[key];
    $$('.type', map).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.type === key)));
    $('.tp-kicker', panel).textContent = d.k;
    const name = $('.tp-name', panel);
    name.textContent = d.name;
    name.setAttribute('lang', 'ja');
    $('.tp-desc', panel).textContent = d.desc;
    $('.tp-ex', panel).textContent = d.ex;
    $('.tp-temp', panel).textContent = d.temp;
    $('.tp-food', panel).textContent = d.food;
    if (window.gsap) window.gsap.fromTo(panel.children, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.04, ease: 'power2.out', overwrite: true });
  };
  map.addEventListener('click', (e) => {
    const b = e.target.closest('.type');
    if (b) show(b.dataset.type);
  });
  show('kun');
}

/* ───────── 2-1 grades ───────── */
export function initGrades() {
  const root = $('[data-grades]');
  if (!root) return;
  const range = $('#polish', root);
  const out = $('#polish-out span', root);
  const sw = $('#alc', root);
  const result = $('.grades-result', root);
  const cards = $$('.grade', root);

  const update = () => {
    const p = +range.value;
    const alc = sw.getAttribute('aria-checked') === 'true';
    out.textContent = p;
    setFill(range);
    range.setAttribute('aria-valuetext', `精米步合 ${p}%`);
    state.gradePolish = p / 100;

    let top = null;
    const ok = [];
    cards.forEach((c) => {
      const match = (c.dataset.alc === '1') === alc;
      const on = match && p <= +c.dataset.max;
      const special = match && !on && c.dataset.special === '1';
      c.classList.toggle('is-on', on);
      c.classList.toggle('is-special', special);
      c.classList.remove('is-top');
      if (on) { ok.push(c); if (!top || +c.dataset.rank > +top.dataset.rank) top = c; }
    });
    if (top) top.classList.add('is-top');
    const names = ok.map((c) => `<b lang="ja">${c.querySelector('b').textContent}</b>`);
    if (names.length) {
      result.innerHTML = `精米步合 ${p}%${alc ? '、添加釀造酒精' : '、不添加'}：可以標示 ${names.join('、')}。`;
    } else {
      result.innerHTML = `精米步合 ${p}%、添加釀造酒精：不符合任何特定名稱，標示為 <b lang="ja">普通酒</b>。<span class="mono" style="color:var(--paper-3)">（「特別本醸造」若採特別製法仍可使用）</span>`;
    }
  };
  range.addEventListener('input', update);
  sw.addEventListener('click', () => {
    sw.setAttribute('aria-checked', String(sw.getAttribute('aria-checked') !== 'true'));
    update();
  });
  update();
}

/* ───────── 2-2 label ───────── */
const TERMS = {
  name: ['銘柄', '酒的品牌名稱。這支「心白」是本站虛構的。'],
  grade: ['純米吟醸', '特定名稱。只用米、米麴和水，精米步合 60% 以下，並用吟釀造的方式釀成。往上看第 04 節。'],
  nama: ['生詰・原酒', '「生詰」：貯藏前火入れ一次，出貨時不再加熱。「原酒」：搾出後沒有加水調整，所以酒精度偏高。'],
  rice: ['使用米', '使用的米種和比例。山田錦是最有名的酒造好適米，見第 09 節。'],
  polish: ['精米歩合 55%', '磨掉外側 45%、留下 55%。不過，同樣的數字，球形精米和扁平精米的內容可能不同，見第 08 節。'],
  abv: ['アルコール分', '酒精度。一般日本酒在 15 度上下，原酒常見 17–20 度；近年也有刻意壓到 13 度左右的低酒精原酒。'],
  smv: ['日本酒度 +3', '正值偏辛，負值偏甘，但要和酸度一起看才準。+3 略偏辛口。到第 07 節實際拖拖看。'],
  acid: ['酸度 1.5', '酸度高，口感更立體、顯得辛口；酸度低則比較柔和。市售酒大多落在 1.0–2.0 之間。'],
  amino: ['アミノ酸度 1.2', '鮮味（旨味）的指標。數值越高越濃郁，太高則容易出現雜味。'],
  date: ['製造年月', '指的是裝瓶的年月，不是釀造的年月。日本酒沒有標示賞味期限的義務，但開瓶後最好盡快喝完，未開瓶時放在陰涼處保存。'],
};

export function initLabel() {
  const wrap = $('.label-wrap');
  if (!wrap) return;
  const term = $('.lp-term', wrap), desc = $('.lp-desc', wrap), kicker = $('.lp-kicker', wrap);
  const hots = $$('.sl-hot', wrap);
  const show = (btn) => {
    const [t, d] = TERMS[btn.dataset.term];
    hots.forEach((h) => { h.classList.toggle('is-active', h === btn); h.setAttribute('aria-pressed', String(h === btn)); });
    kicker.textContent = '酒標用語';
    term.textContent = t;
    term.setAttribute('lang', 'ja');
    desc.textContent = d;
    if (window.gsap) window.gsap.fromTo([term, desc], { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.45, stagger: 0.05, ease: 'power2.out', overwrite: true });
  };
  hots.forEach((h) => { h.setAttribute('aria-pressed', 'false'); h.addEventListener('click', () => show(h)); });
  show(hots.find((h) => h.dataset.term === 'grade'));
}

/* ───────── 3-1 SMV × acid ───────── */
const AK = (smv, acid) => 193593 / (1443 + smv) - 1.16 * acid - 132.57;
const NT = (smv, acid) => 94545 / (1443 + smv) + 1.88 * acid - 68.54;
const akWord = (v) => (v > 0.5 ? '甘口' : v > 0 ? '略甘' : v > -0.5 ? '略辛' : '辛口');
const ntWord = (v) => (v > 0.5 ? '濃醇' : v > 0 ? '偏濃醇' : v > -0.5 ? '偏淡麗' : '淡麗');
const fmt = (v, d = 1) => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toFixed(d);

export function initMeter() {
  const svg = $('.meter-svg');
  if (!svg) return;
  const NS = 'http://www.w3.org/2000/svg';
  const X0 = 64, X1 = 584, Y0 = 34, Y1 = 386;
  const xOf = (s) => X0 + ((s + 15) / 30) * (X1 - X0);
  const yOf = (a) => Y1 - ((a - 0.8) / 1.6) * (Y1 - Y0);
  const sOf = (x) => ((x - X0) / (X1 - X0)) * 30 - 15;
  const aOf = (y) => 0.8 + ((Y1 - y) / (Y1 - Y0)) * 1.6;
  const el = (tag, attrs, parent) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); parent && parent.appendChild(n); return n; };

  // clip
  const defs = el('defs', {}, svg);
  const clip = el('clipPath', { id: 'm-clip' }, defs);
  el('rect', { x: X0, y: Y0, width: X1 - X0, height: Y1 - Y0 }, clip);

  // grid + axes
  const grid = $('.m-grid', svg), axes = $('.m-axes', svg);
  for (let s = -15; s <= 15; s += 5) {
    el('line', { x1: xOf(s), x2: xOf(s), y1: Y0, y2: Y1 }, grid);
    const t = el('text', { x: xOf(s), y: Y1 + 20, 'text-anchor': 'middle' }, axes);
    t.textContent = s > 0 ? `+${s}` : s;
  }
  for (let a = 0.8; a <= 2.41; a += 0.4) {
    el('line', { x1: X0, x2: X1, y1: yOf(a), y2: yOf(a) }, grid);
    const t = el('text', { x: X0 - 10, y: yOf(a) + 4, 'text-anchor': 'end' }, axes);
    t.textContent = a.toFixed(1);
  }
  const tx = el('text', { x: X1, y: Y1 + 42, 'text-anchor': 'end' }, axes); tx.textContent = '日本酒度 →';
  const ty = el('text', { x: X0, y: Y0 - 14, 'text-anchor': 'start' }, axes); ty.textContent = '↑ 酸度';

  // iso-lines where 甘辛度 = 0 and 濃淡度 = 0
  const akLine = [], ntLine = [];
  for (let s = -15; s <= 15.001; s += 0.25) {
    akLine.push([xOf(s), yOf((193593 / (1443 + s) - 132.57) / 1.16)]);
    ntLine.push([xOf(s), yOf((68.54 - 94545 / (1443 + s)) / 1.88)]);
  }
  const toPath = (pts) => 'M' + pts.map((p) => p.map((v) => v.toFixed(1)).join(' ')).join(' L');
  const lAk = $('.m-line-ak', svg), lNt = $('.m-line-nt', svg);
  lAk.setAttribute('d', toPath(akLine)); lAk.setAttribute('clip-path', 'url(#m-clip)');
  lNt.setAttribute('d', toPath(ntLine)); lNt.setAttribute('clip-path', 'url(#m-clip)');

  // tinted half-planes: above the 甘辛 line = drier, above the 濃淡 line = richer
  const regions = $('.m-regions', svg);
  regions.setAttribute('clip-path', 'url(#m-clip)');
  el('path', { d: toPath(akLine) + ` L${X1} ${Y0 - 400} L${X0} ${Y0 - 400} Z`, fill: 'rgba(214,188,132,.07)' }, regions);
  el('path', { d: toPath(ntLine) + ` L${X1} ${Y0 - 400} L${X0} ${Y0 - 400} Z`, fill: 'rgba(143,193,181,.07)' }, regions);

  // region labels at the centroid of each sign class
  const acc = {};
  for (let s = -15; s <= 15; s += 0.5) for (let a = 0.8; a <= 2.4; a += 0.02) {
    const key = (AK(s, a) > 0 ? '甘口' : '辛口') + '・' + (NT(s, a) > 0 ? '濃醇' : '淡麗');
    (acc[key] ||= { x: 0, y: 0, n: 0 });
    acc[key].x += xOf(s); acc[key].y += yOf(a); acc[key].n++;
  }
  const labels = $('.m-labels', svg);
  Object.entries(acc).forEach(([k, v]) => {
    if (v.n < 60) return;
    const t = el('text', { x: (v.x / v.n).toFixed(0), y: (v.y / v.n).toFixed(0), 'text-anchor': 'middle', class: 'm-q' }, labels);
    t.textContent = k;
  });

  const smv = $('#smv'), acid = $('#acid');
  const smvOut = $('#smv-out'), acidOut = $('#acid-out');
  const pt = $('.m-point', svg);
  const akB = $('.mr-ak'), akT = $('.mr-ak-t'), ntB = $('.mr-nt'), ntT = $('.mr-nt-t');
  const presets = $$('.presets button');

  const update = (fromPreset) => {
    const s = +smv.value, a = +acid.value;
    setFill(smv); setFill(acid);
    smvOut.textContent = s > 0 ? `+${s}` : s < 0 ? `−${Math.abs(s)}` : '±0';
    acidOut.textContent = a.toFixed(2).replace(/0$/, '');
    pt.setAttribute('transform', `translate(${xOf(s).toFixed(1)} ${yOf(a).toFixed(1)})`);
    const ak = AK(s, a), nt = NT(s, a);
    akB.textContent = fmt(ak, 2); akT.textContent = akWord(ak);
    ntB.textContent = fmt(nt, 2); ntT.textContent = ntWord(nt);
    if (!fromPreset) presets.forEach((b) => b.classList.remove('is-active'));
  };

  const setFromEvent = (e) => {
    const m = svg.getScreenCTM();
    if (!m) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    const s = Math.max(-15, Math.min(15, Math.round(sOf(p.x) * 2) / 2));
    const a = Math.max(0.8, Math.min(2.4, Math.round(aOf(p.y) * 20) / 20));
    smv.value = s; acid.value = a;
    update();
  };
  let drag = false;
  svg.addEventListener('pointerdown', (e) => { drag = true; svg.setPointerCapture(e.pointerId); setFromEvent(e); });
  svg.addEventListener('pointermove', (e) => { if (drag) setFromEvent(e); });
  const end = () => { drag = false; };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  smv.addEventListener('input', () => update());
  acid.addEventListener('input', () => update());
  presets.forEach((b) => b.addEventListener('click', () => {
    presets.forEach((x) => x.classList.toggle('is-active', x === b));
    const go = () => { smv.value = b.dataset.smv; acid.value = b.dataset.acid; update(true); };
    if (window.gsap) {
      const o = { s: +smv.value, a: +acid.value };
      window.gsap.to(o, { s: +b.dataset.smv, a: +b.dataset.acid, duration: 0.8, ease: 'power3.inOut', onUpdate: () => {
        smv.value = Math.round(o.s * 2) / 2; acid.value = Math.round(o.a * 20) / 20; update(true);
      }, onComplete: go });
    } else go();
  }));
  update();
}

/* ───────── 3-2 shape ───────── */
export function initShape() {
  const root = $('[data-shape]');
  if (!root) return;
  const btns = $$('[data-shape-mode]', root);
  const inner = $('.sh-inner', root), core = $('.sh-core', root);
  // side view of a grain: length (rx) × thickness (ry). Both keep ~the same area (same polish ratio);
  // spherical milling trims the long axis harder, flat milling trims the thickness harder.
  const SHAPES = [{ rx: 70, ry: 54 }, { rx: 102, ry: 37 }];
  const set = (mode) => {
    btns.forEach((b) => b.setAttribute('aria-checked', String(+b.dataset.shapeMode === mode)));
    state.flat = mode;
    const s = SHAPES[mode];
    if (window.gsap) {
      window.gsap.to(inner, { attr: s, duration: 1.1, ease: 'expo.inOut' });
      window.gsap.to(core, { attr: { rx: s.rx * 0.5, ry: s.ry * 0.48 }, duration: 1.1, ease: 'expo.inOut' });
    } else {
      inner.setAttribute('rx', s.rx); inner.setAttribute('ry', s.ry);
    }
  };
  btns.forEach((b) => b.addEventListener('click', () => set(+b.dataset.shapeMode)));
  root.addEventListener('keydown', (e) => {
    if (!e.target.closest('[data-shape-mode]')) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      const next = state.flat ? 0 : 1;
      set(next);
      btns[next].focus();
    }
  });
  set(0);
}

/* ───────── 3-5 temperature ───────── */
const TEMPS = [
  { c: 5, name: '雪冷え', kana: 'ゆきびえ', desc: '冰箱冷藏室的溫度。香氣收得很緊，口感俐落清爽，適合爽酒。太冰會蓋住味道。' },
  { c: 10, name: '花冷え', kana: 'はなびえ', desc: '從冰箱拿出來放一下。香氣開始浮現，酸味清楚。吟釀酒常從這個溫度開始喝。' },
  { c: 15, name: '涼冷え', kana: 'すずびえ', desc: '微涼。香氣和甜味的平衡點，也是薰酒香氣最舒展的溫度之一。' },
  { c: 20, name: '冷や（常温）', kana: 'ひや', desc: '室溫。最能看出一支酒原本的樣子，醇酒的鮮味從這裡開始出來。' },
  { c: 30, name: '日向燗', kana: 'ひなたかん', desc: '比體溫略低，喝起來不會覺得燙。香氣變柔和，米香浮現。' },
  { c: 35, name: '人肌燗', kana: 'ひとはだかん', desc: '接近體溫。米的甜味和鮮味展開，口感變得圓潤。' },
  { c: 40, name: 'ぬる燗', kana: 'ぬるかん', desc: '微溫。香氣最飽滿的溫度之一，純米、生酛類的酒在這裡特別好喝。' },
  { c: 45, name: '上燗', kana: 'じょうかん', desc: '端起來有點熱。香氣變得俐落、味道收緊，酸味感覺更柔和。' },
  { c: 50, name: '熱燗', kana: 'あつかん', desc: '酒器口會冒出熱氣。辛口感變明顯，尾韻乾淨，適合配油脂多的料理。' },
  { c: 55, name: '飛び切り燗', kana: 'とびきりかん', desc: '55℃ 以上。香氣銳利、辛口感最強。寒冬配下酒菜的溫度。' },
];

export function initTemp() {
  const range = $('#tempr');
  if (!range) return;
  const deg = $('.temp-deg'), name = $('.temp-name'), kana = $('.temp-kana'), desc = $('.temp-desc');
  const update = () => {
    const d = TEMPS[+range.value];
    setFill(range);
    deg.textContent = d.c;
    name.textContent = d.name;
    kana.textContent = d.kana;
    desc.textContent = d.desc;
    range.setAttribute('aria-valuetext', `${d.name}，約 ${d.c}℃`);
    state.temp = d.c < 20 ? (d.c - 20) / 15 : (d.c - 20) / 35;
  };
  range.addEventListener('input', update);
  update();
}

export function initAll() {
  initTypes();
  initGrades();
  initLabel();
  initMeter();
  initShape();
  initTemp();
}
