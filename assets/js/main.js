import { Scene } from './scene.js';
import { initAll, state } from './interactives.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const html = document.documentElement;
const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const mqMobile = window.matchMedia('(max-width: 899px)');
const { gsap, ScrollTrigger, SplitText, Lenis } = window;
const hasGsap = !!(gsap && ScrollTrigger);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (t) => t * t * (3 - 2 * t);

/* ───────── WebGL ───────── */
const canvas = $('#gl');
const scene = new Scene(canvas, { reducedMotion: RM, mobile: mqMobile.matches || (navigator.hardwareConcurrency || 8) <= 4 });
if (!scene.ok) html.classList.add('no-gl');

/* ───────── smooth scroll ───────── */
let lenis = null;
if (hasGsap) gsap.registerPlugin(ScrollTrigger, ...(SplitText ? [SplitText] : []));
if (!RM && Lenis && hasGsap) {
  lenis = new Lenis({ lerp: 0.095, wheelMultiplier: 0.95, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
const scrollY = () => (lenis ? lenis.scroll : window.scrollY);
window.__shinpaku = { lenis, scene };

function scrollToTarget(target) {
  if (!target) return;
  if (lenis) lenis.scrollTo(target, { duration: 1.8, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else target.scrollIntoView({ behavior: RM ? 'auto' : 'smooth' });
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href');
  const target = id === '#top' ? document.body : $(id);
  if (!target) return;
  e.preventDefault();
  scrollToTarget(id === '#top' ? 0 : target);
  if (id === '#main') $('#main').focus?.();
  history.replaceState(null, '', id === '#top' ? location.pathname : id);
});

/* ───────── scene choreography ───────── */
// The rice grain lives on "stages": empty boxes in the layout ([data-stage]).
// It tracks the most visible stage, so it scrolls with the page and never sits on text.
// [data-p] elements are polish-ratio anchors for the gauge.
let stages = [], pAnchors = [], layers = [], docH = 1;
let active = null;

function measure() {
  const sy = scrollY();
  const vh = innerHeight;
  stages = $$('[data-stage]').map((el) => ({ el, kind: el.dataset.stageKind || '', max: parseFloat(el.dataset.stage) || 1 }));
  pAnchors = $$('[data-p]').map((el) => {
    const r = el.getBoundingClientRect();
    return { at: r.top + sy + Math.min(r.height * 0.5, vh * 0.5), v: +el.dataset.p };
  }).sort((x, y) => x.at - y.at);
  layers = ['surface', 'middle', 'deep', 'core'].map((id) => {
    const r = document.getElementById(id).getBoundingClientRect();
    return { id, top: r.top + sy };
  });
  docH = Math.max(1, document.documentElement.scrollHeight - vh);
}

function stageInfo(st) {
  const r = st.el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return null;
  const vw = innerWidth, vh = innerHeight;
  const vis = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0)) / Math.min(r.height, vh);
  if (vis <= 0) return null;
  const cy = r.top + r.height / 2;
  const center = 1 - Math.min(1, Math.abs(cy - vh / 2) / vh);
  const sc = Math.min(1.45, (r.height * 0.8) / (0.41 * vh), (r.width * 0.8) / (0.33 * vh));
  return { st, vis, w: vis * 0.7 + center * 0.3, x: ((r.left + r.width / 2) / vw) * 2 - 1, y: 1 - (cy / vh) * 2, s: sc };
}

function interpNum(list, probe) {
  if (!list.length) return 100;
  if (probe <= list[0].at) return list[0].v;
  for (let i = 0; i < list.length - 1; i++) {
    const x = list[i], y = list[i + 1];
    if (probe <= y.at) return x.v + (y.v - x.v) * clamp((probe - x.at) / Math.max(1, y.at - x.at), 0, 1);
  }
  return list[list.length - 1].v;
}

/* ───────── gauge ───────── */
const gaugeVal = $('.gauge-val');
const gaugeFill = $('.gauge-fill');
const gaugeDot = $('.gauge-dot');
const gaugeRail = $('.gauge-rail');
const gaugeLinks = $$('.gauge-list a');
let lastP = -1, lastLayer = '';

function sizeRail() {
  if (mqMobile.matches) { gaugeRail.style.height = ''; return; }
  const list = $('.gauge-list');
  gaugeRail.style.height = list.offsetHeight + 'px';
}

/* ───────── per-frame update ───────── */
let mouse = { x: 0, y: 0 };
window.addEventListener('pointermove', (e) => {
  mouse.x = (e.clientX / innerWidth) * 2 - 1;
  mouse.y = -((e.clientY / innerHeight) * 2 - 1);
}, { passive: true });

function update(dt) {
  const sy = scrollY();
  const probe = sy + innerHeight * 0.5;
  const polish = interpNum(pAnchors, probe);

  const gauge = Math.round(polish);
  if (gauge !== lastP) { gaugeVal.textContent = gauge; lastP = gauge; }
  const prog = clamp(sy / docH, 0, 1);
  if (mqMobile.matches) {
    gaugeFill.style.width = `${prog * 100}%`;
    gaugeFill.style.height = '';
  } else {
    gaugeFill.style.width = '';
    gaugeFill.style.height = `${prog * 100}%`;
    gaugeDot.style.top = `${prog * 100}%`;
  }
  const layer = (layers.slice().reverse().find((l) => probe >= l.top) || {}).id || '';
  if (layer !== lastLayer) {
    if (lastLayer !== '' || layer !== '') { if (layer && html.classList.contains('is-loaded')) scene.pulse(); }
    gaugeLinks.forEach((a) => {
      const on = a.dataset.layer === layer;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
    });
    lastLayer = layer;
  }

  // pick a stage
  const infos = stages.map(stageInfo).filter(Boolean);
  const cur = active ? infos.find((i) => i.st === active) : null;
  let best = infos.filter((i) => i.vis > 0.3).sort((x, y) => y.w - x.w)[0] || null;
  if (cur && cur.vis > 0.45) best = cur;

  const T = scene.target, C = scene.cur;
  const place = (info, snapScale) => {
    T.gx = C.gx = info.x;
    T.gy = C.gy = info.y;
    T.gs = info.s;
    if (snapScale) C.gs = info.s;
  };
  let shown = null;
  if (!best) {
    T.go = 0;
    if (cur) place(cur);
  } else if (best.st !== active) {
    if (active && C.go > 0.06) {
      T.go = 0;                       // fade out where it was, then jump
      if (cur) place(cur);
    } else {
      active = best.st;
      place(best, true);
      shown = best;
    }
  } else {
    place(best);
    shown = best;
  }
  if (shown) T.go = shown.st.max * smooth(clamp((shown.vis - 0.2) / 0.5, 0, 1));

  const kind = shown ? shown.st.kind : '';
  let p = polish / 100;
  if (kind === 'grades') p = state.gradePolish;
  if (kind === 'shape') p = 0.5;
  T.polish = p;
  T.flat = kind === 'shape' ? state.flat : 0;
  T.temp = kind === 'temp' ? state.temp : 0;
  T.core = kind === 'core' ? smooth(clamp((shown.vis - 0.3) / 0.65, 0, 1)) : 0;
  T.depth = prog;
  T.mx = mouse.x; T.my = mouse.y;
  scene.render(dt);
}

/* ───────── reveals ───────── */
function setupMotion() {
  if (!hasGsap || RM) return;

  // big kanji: characters rise out of a blur
  $$('[data-split]').forEach((el) => {
    if (el.closest('.hero')) return;
    const split = SplitText ? new SplitText(el, { type: 'chars', charsClass: 'char', aria: 'none' }) : null;
    const targets = split ? split.chars : [el];
    gsap.from(targets, {
      yPercent: 40, opacity: 0, filter: 'blur(14px)', duration: 1.6, ease: 'expo.out', stagger: 0.12,
      scrollTrigger: { trigger: el, start: 'top 82%' },
    });
    gsap.to(el, { yPercent: -12, ease: 'none', scrollTrigger: { trigger: el.closest('.gate'), start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  $$('.gate').forEach((g) => {
    gsap.from(g.querySelectorAll('.gate-num, .gate-zh, .gate-lead'), {
      y: 30, opacity: 0, duration: 1.2, ease: 'power3.out', stagger: 0.12,
      scrollTrigger: { trigger: g, start: 'top 60%' },
    });
  });

  $$('.block-head').forEach((h) => {
    const items = h.querySelectorAll('.eyebrow, .h3, .lede');
    gsap.from(items, {
      y: 36, opacity: 0, duration: 1.1, ease: 'power3.out', stagger: 0.1,
      scrollTrigger: { trigger: h, start: 'top 82%' },
    });
  });

  ScrollTrigger.batch('.reveal', {
    start: 'top 88%',
    onEnter: (els) => gsap.fromTo(els, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, ease: 'power3.out', stagger: 0.09, overwrite: true }),
  });
  gsap.set('.reveal', { opacity: 0 });

  // grade cards & process steps
  gsap.from('.grade', { y: 24, opacity: 0, duration: 0.9, stagger: 0.05, ease: 'power3.out', scrollTrigger: { trigger: '.grades', start: 'top 85%' }, clearProps: 'opacity,transform' });
  gsap.from('.bar-track i', { scaleX: 0, duration: 1.4, ease: 'expo.out', stagger: 0.2, scrollTrigger: { trigger: '.shape-bars', start: 'top 80%' } });
  gsap.from('.sl-paper', { rotateY: -30, rotateX: 8, y: 60, opacity: 0, duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: '.sakelabel', start: 'top 85%' }, clearProps: 'transform,opacity' });
  gsap.from('.core-title, .core-quote, .core-end, .core-again', { y: 40, opacity: 0, filter: 'blur(10px)', duration: 1.8, stagger: 0.25, ease: 'power3.out', scrollTrigger: { trigger: '.core', start: 'top 30%' } });

  // horizontal process on wide screens
  const mm = gsap.matchMedia();
  mm.add('(min-width: 1000px)', () => {
    const block = $('.block-process');
    const track = $('.process');
    block.classList.add('is-pinnable');
    const dist = () => Math.max(0, track.scrollWidth - innerWidth + parseFloat(getComputedStyle(track).paddingLeft));
    const tween = gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: { trigger: '.process-pin', start: 'top top', end: () => `+=${dist()}`, pin: true, scrub: 0.6, invalidateOnRefresh: true, anticipatePin: 1 },
    });
    const steps = gsap.utils.toArray('.step');
    steps.forEach((s) => {
      gsap.from(s.querySelectorAll('.step-ic, h4, p'), {
        y: 30, opacity: 0, duration: 0.8, stagger: 0.06, ease: 'power3.out',
        scrollTrigger: { trigger: s, containerAnimation: tween, start: 'left 85%' },
      });
    });
    return () => block.classList.remove('is-pinnable');
  });
}

/* ───────── intro ───────── */
function intro() {
  const loader = $('.loader');
  const v = $('.loader-v');
  const heroK = $('.hero-k');
  const finish = () => {
    html.classList.add('is-loaded');
    if (lenis) lenis.start();
  };
  if (!hasGsap || RM) {
    loader.style.display = 'none';
    finish();
    return;
  }
  lenis && lenis.stop();
  const split = SplitText ? new SplitText(heroK, { type: 'chars', charsClass: 'char', aria: 'none' }) : null;
  const chars = split ? split.chars : [heroK];
  gsap.set(chars, { opacity: 0, yPercent: 30, filter: 'blur(18px)' });
  gsap.set('.hero-zh, .hero-lead, .hero-meta, .hero-cue, .brand, .gauge', { opacity: 0 });
  scene.cur.go = 0;

  const counter = { n: 0 };
  const fontsReady = Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise((r) => setTimeout(r, 1500))]);
  const count = gsap.to(counter, { n: 100, duration: 0.9, ease: 'power2.inOut', onUpdate: () => { v.textContent = Math.round(counter.n); } });
  const tl = gsap.timeline({ paused: true });
  tl.to('.loader-k, .loader-n', { opacity: 0, y: -16, duration: 0.45, ease: 'power2.in' })
    .to(loader, { opacity: 0, duration: 0.6, ease: 'power2.out', onComplete: () => { loader.style.display = 'none'; finish(); } }, '-=0.1')
    .to(chars, { opacity: 1, yPercent: 0, filter: 'blur(0px)', duration: 2, ease: 'expo.out', stagger: 0.18 }, '-=0.6')
    .to('.hero-zh', { opacity: 1, duration: 1.4, ease: 'power2.out' }, '-=1.6')
    .to('.hero-meta, .brand, .gauge', { opacity: 1, duration: 1.2, ease: 'power2.out' }, '-=1.4')
    .fromTo('.hero-lead', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 1.2, stagger: 0.15, ease: 'power3.out' }, '-=1.2')
    .to('.hero-cue', { opacity: 1, duration: 1 }, '-=0.6');
  Promise.all([fontsReady, new Promise((r) => count.eventCallback('onComplete', r))]).then(() => {
    tl.play();
    gsap.delayedCall(0.9, () => { ScrollTrigger.refresh(); });
  });
}

/* ───────── cursor follower (fine pointers only) ───────── */
function setupCursor() {
  if (RM || !hasGsap || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const dot = document.createElement('div');
  dot.className = 'cursor';
  dot.setAttribute('aria-hidden', 'true');
  document.body.appendChild(dot);
  const xTo = gsap.quickTo(dot, 'x', { duration: 0.35, ease: 'power3.out' });
  const yTo = gsap.quickTo(dot, 'y', { duration: 0.35, ease: 'power3.out' });
  window.addEventListener('pointermove', (e) => { xTo(e.clientX); yTo(e.clientY); dot.classList.add('is-on'); }, { passive: true });
  document.addEventListener('pointerleave', () => dot.classList.remove('is-on'));
  const HOT = 'a, button, input, label, .meter-svg';
  document.addEventListener('pointerover', (e) => { dot.classList.toggle('is-hot', !!e.target.closest(HOT)); });
}

/* ───────── boot ───────── */
initAll();
setupMotion();
setupCursor();
intro();

const onResize = () => { sizeRail(); measure(); scene.resize(); };
if (hasGsap) {
  ScrollTrigger.addEventListener('refresh', () => { sizeRail(); measure(); });
  ScrollTrigger.refresh();
} else {
  window.addEventListener('resize', onResize, { passive: true });
}
if (document.fonts) document.fonts.ready.then(() => { hasGsap ? ScrollTrigger.refresh() : onResize(); });
mqMobile.addEventListener?.('change', () => { scene.mobile = mqMobile.matches; hasGsap ? ScrollTrigger.refresh() : onResize(); });
onResize();

let last = performance.now();
if (hasGsap) {
  gsap.ticker.add(() => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    update(dt);
  });
} else {
  const loop = (now) => { const dt = Math.min(0.1, (now - last) / 1000); last = now; update(dt); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}
