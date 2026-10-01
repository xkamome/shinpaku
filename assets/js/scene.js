// WebGL scene: an ink-dark water column with light shafts and drifting spores,
// and a single raymarched rice grain whose outer layers are "polished" away by scroll.

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform vec2  uRes;
uniform float uTime;
uniform float uDepth;
uniform vec2  uMouse;
uniform vec4  uGrain;   // x, y (screen, -1..1), scale, opacity
uniform float uPolish;  // remaining fraction 0.01..1
uniform float uFlat;    // 0 spherical milling, 1 flat milling
uniform float uTemp;    // -1 cold .. 1 hot
uniform float uCore;    // finale glow
uniform float uPulse;   // 0..1 ring that ripples out when a new layer begins
uniform float uQuality; // 0 low .. 1 high

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
  return v;
}

float spores(vec2 p, float scale, float speed, float seed) {
  vec2 q = p * scale;
  q.y -= uTime * speed;
  q.x += sin(q.y * 0.35 + seed) * 0.4;
  vec2 id = floor(q);
  vec2 f = fract(q) - 0.5;
  float h = hash(id + seed);
  if (h > 0.16) return 0.0;
  vec2 o = vec2(hash(id * 1.31 + seed), hash(id * 2.17 + seed)) - 0.5;
  float r = length(f - o * 0.6);
  float tw = 0.55 + 0.45 * sin(uTime * 1.3 + h * 80.0);
  return smoothstep(0.075, 0.0, r) * tw;
}

vec3 background(vec2 uv, vec2 p) {
  float d = uDepth;
  vec3 top = mix(vec3(0.030, 0.046, 0.062), vec3(0.036, 0.029, 0.024), d);
  vec3 bot = mix(vec3(0.010, 0.014, 0.020), vec3(0.016, 0.012, 0.009), d);
  vec3 col = mix(bot, top, smoothstep(-0.2, 1.1, uv.y));

  vec2 q = p * 1.1 + vec2(0.0, uTime * 0.012 + d * 2.0);
  float w = fbm(q + 1.4 * fbm(q * 1.6 + uTime * 0.015));
  col += vec3(0.060, 0.064, 0.068) * smoothstep(0.42, 0.95, w) * 0.75;

  float ang = p.x * 0.9 + p.y * 0.32;
  float shafts = pow(noise(vec2(ang * 3.6 + uTime * 0.035, 0.5)), 3.0)
               + 0.6 * pow(noise(vec2(ang * 8.0 - uTime * 0.025, 3.1)), 4.0);
  shafts *= smoothstep(-0.9, 1.0, p.y);
  col += vec3(0.62, 0.70, 0.74) * shafts * 0.11 * (1.0 - d * 0.8);

  float s = spores(p, 9.0, 0.05, 1.7) * 0.55 + spores(p, 16.0, 0.08, 7.3) * 0.32;
  if (uQuality > 0.5) s += spores(p, 28.0, 0.12, 3.9) * 0.18;
  col += vec3(1.0, 0.95, 0.86) * s * mix(0.55, 0.9, d);

  return col;
}

mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }

float sdEllipsoid(vec3 p, vec3 r) {
  float k0 = length(p / r);
  float k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / k1;
}

// analytic ray / ellipsoid intersection (object space); returns entry & exit t, or -1
vec2 iEllipsoid(vec3 o, vec3 d, vec3 r) {
  vec3 oc = o / r, dc = d / r;
  float a = dot(dc, dc), b = dot(oc, dc), c = dot(oc, oc) - 1.0;
  float h = b * b - a * c;
  if (h < 0.0) return vec2(-1.0);
  h = sqrt(h);
  return vec2((-b - h) / a, (-b + h) / a);
}

const vec3 R0 = vec3(0.34, 0.56, 0.235);

vec3 grainRadii() {
  float pol = clamp(uPolish, 0.01, 1.0);
  float vol = R0.x * R0.y * R0.z * pol;
  float gm = pow(R0.x * R0.y * R0.z, 1.0 / 3.0);
  float round = pow(1.0 - pol, 0.55) * 0.92;
  vec3 sph = mix(R0, vec3(gm), round);
  vec3 flt = R0 * vec3(1.02, 1.06, 0.80);
  vec3 S = mix(sph, flt, uFlat);
  S *= pow(vol / (S.x * S.y * S.z), 1.0 / 3.0);
  return S;
}

float grainSDF(vec3 q, vec3 S) {
  float brown = smoothstep(0.86, 1.0, uPolish);
  float taper = 1.0 - 0.10 * clamp(q.y / S.y, -1.0, 1.0) * smoothstep(0.5, 1.0, uPolish);
  float d = sdEllipsoid(vec3(q.x / taper, q.y, q.z / taper), S) * taper;
  float a = atan(q.z / S.z, q.x / S.x);
  d += 0.004 * sin(a * 6.0) * (1.0 - smoothstep(0.55, 1.0, abs(q.y) / S.y)) * brown;
  float notch = length(q - vec3(S.x * 0.66, -S.y * 0.84, 0.0)) - 0.075;
  d = mix(d, max(d, -notch), brown);
  return d;
}

vec3 calcNormal(vec3 q, vec3 S) {
  const vec2 e = vec2(0.0012, -0.0012);
  return normalize(e.xyy * grainSDF(q + e.xyy, S) + e.yyx * grainSDF(q + e.yyx, S) +
                   e.yxy * grainSDF(q + e.yxy, S) + e.xxx * grainSDF(q + e.xxx, S));
}

void main() {
  vec2 uv = vUv;
  float aspect = uRes.x / uRes.y;
  vec2 p = (uv * 2.0 - 1.0) * vec2(aspect, 1.0);

  vec3 col = background(uv, p);

  vec2 c = vec2(uGrain.x * aspect, uGrain.y);
  float sc = max(uGrain.z, 0.001);
  vec2 gp = (p - c) / sc;
  float alpha = uGrain.w;

  if (alpha > 0.002) {
    vec3 S = grainRadii();
    float t = uTime;
    mat3 R = rotZ(-0.42 + uMouse.x * 0.10) * rotX(0.18 + uMouse.y * 0.12) * rotY(t * 0.22);
    vec3 ro = vec3(0.0, 0.0, 2.6);
    vec3 rd = normalize(vec3(gp, -1.9));
    vec3 oro = R * ro, ord = R * rd;

    vec3 glowCol = mix(vec3(1.0, 0.95, 0.87), vec3(1.0, 0.80, 0.58), max(uTemp, 0.0) * 0.7);
    glowCol = mix(glowCol, vec3(0.80, 0.90, 1.0), max(-uTemp, 0.0) * 0.6);

    float rr = length(gp) / (S.y * 1.25);
    float halo = exp(-rr * 2.4) * 0.16 + exp(-rr * 6.0) * 0.12;
    float ang = atan(gp.y, gp.x);
    float rays = pow(noise(vec2(ang * 7.0, t * 0.07)), 5.0) * exp(-rr * 0.9) * uCore * 0.42;

    float pxw = 3.5 / (uRes.y * sc);
    vec2 bb = iEllipsoid(oro, ord, S * 1.12);
    float cov = 0.0;
    vec3 gcol = vec3(0.0);

    if (bb.y > 0.0) {
      float tt = max(bb.x, 0.0);
      float minD = 1e3, tMin = tt;
      for (int i = 0; i < 64; i++) {
        vec3 q = oro + ord * tt;
        float d = grainSDF(q, S);
        if (d < minD) { minD = d; tMin = tt; }
        if (d < 0.0004) break;
        tt += max(d * 0.9, 0.0006);
        if (tt > bb.y) break;
      }
      cov = 1.0 - smoothstep(0.0, pxw, minD);
      if (cov > 0.0) {
        vec3 q = oro + ord * tMin;
        vec3 n = calcNormal(q, S) * R; // object -> view (R orthonormal)

        float polished = smoothstep(1.0, 0.86, uPolish);
        vec3 brown = vec3(0.50, 0.37, 0.23);
        vec3 milky = vec3(0.88, 0.87, 0.83);
        vec3 base = mix(brown, milky, polished);

        vec3 L1 = normalize(vec3(-0.45, 0.85, 0.55));
        vec3 L2 = normalize(vec3(uMouse.x * 1.4, uMouse.y + 0.2, 1.0));
        float wrap = clamp((dot(n, L1) + 0.55) / 1.55, 0.0, 1.0);
        float fill = max(dot(n, normalize(vec3(0.7, -0.4, 0.6))), 0.0) * 0.14;
        float dif2 = pow(max(dot(n, L2) * 0.5 + 0.5, 0.0), 4.0) * 0.30;
        float spe = pow(max(dot(n, normalize(L1 - rd)), 0.0), 48.0) * mix(0.05, 0.30, polished);
        float fres = pow(1.0 - max(dot(n, -rd), 0.0), 2.5);
        vec3 surf = base * (0.08 + 0.92 * wrap * wrap + fill + dif2) + spe;

        // translucency: thicker body scatters more light; the opaque white core (shinpaku) glows through
        vec2 tg = iEllipsoid(oro, ord, S);
        float Lg = max(tg.y - max(tg.x, 0.0), 0.0);
        vec3 C = R0 * vec3(0.44, 0.42, 0.40);
        vec2 tc = iEllipsoid(oro, ord, C);
        float Lc = tc.y > 0.0 ? max(tc.y - max(tc.x, 0.0), 0.0) : 0.0;
        float toCore = tc.y > 0.0 ? max(tc.x - tMin, 0.0) : 1.0;
        float absorb = mix(10.0, 2.4, polished) - uCore * 1.4;
        float coreAmt = (1.0 - exp(-Lc * 5.0)) * exp(-toCore * absorb) * 0.82;
        float body = polished * (1.0 - exp(-Lg * 2.6));

        gcol = surf * mix(1.0, 0.76, polished) * (1.0 - 0.45 * uCore)
             + glowCol * body * 0.40
             + glowCol * coreAmt * (0.85 + 1.1 * (1.0 - uPolish) + uCore * 1.4)
             + glowCol * fres * (0.14 + 0.26 * polished + 0.6 * uCore);
        gcol = mix(gcol, gcol * vec3(1.06, 0.98, 0.90), max(uTemp, 0.0) * 0.4);
      }
    }

    float a = cov * alpha;
    col = mix(col, gcol, a * alpha) + gcol * a * (1.0 - alpha) * 0.55;
    col += glowCol * (halo * (0.7 + uCore * 1.4) + rays) * alpha;

    // polish ripple: two thin rings expanding from the grain
    if (uPulse > 0.0 && uPulse < 1.0) {
      float rg = length(gp) / S.y;
      float e = 1.0 - pow(1.0 - uPulse, 3.0);
      float k1 = exp(-abs(rg - mix(0.9, 4.2, e)) * 26.0);
      float k2 = exp(-abs(rg - mix(0.9, 3.0, e)) * 40.0) * 0.5;
      col += glowCol * (k1 + k2) * pow(1.0 - uPulse, 1.6) * 0.55 * alpha;
    }
  }

  // temperature grading
  col = mix(col, col * vec3(1.10, 0.96, 0.82) + vec3(0.025, 0.010, 0.0), max(uTemp, 0.0) * 0.45);
  col = mix(col, col * vec3(0.86, 0.96, 1.10) + vec3(0.0, 0.006, 0.018), max(-uTemp, 0.0) * 0.45);

  // vignette & dither
  float vig = smoothstep(1.55, 0.35, length((uv - 0.5) * vec2(aspect * 0.9, 1.15)));
  col *= mix(0.62, 1.0, vig);
  col += (hash(uv * uRes + fract(uTime)) - 0.5) / 255.0;

  col = col / (1.0 + col * 0.35);
  gl_FragColor = vec4(col, 1.0);
}`;

export class Scene {
  constructor(canvas, { reducedMotion = false, mobile = false } = {}) {
    this.canvas = canvas;
    this.reducedMotion = reducedMotion;
    this.mobile = mobile;
    this.scale = mobile ? 0.5 : 0.62;
    this.minScale = 0.32;
    this.time = 0;
    this.frames = 0;
    this.slow = 0;
    this.pulseT = 1;
    this.target = { gx: 0.36, gy: 0, gs: 1.1, go: 1, polish: 1, flat: 0, temp: 0, core: 0, depth: 0, mx: 0, my: 0 };
    this.cur = { ...this.target };
    this.ok = this.init();
  }

  init() {
    const opts = { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false };
    let gl = null;
    try { gl = this.canvas.getContext('webgl', opts) || this.canvas.getContext('experimental-webgl', opts); } catch (e) { gl = null; }
    if (!gl) return false;
    this.gl = gl;

    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.warn('[shinpaku] shader:', gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    };
    const vs = sh(gl.VERTEX_SHADER, VERT);
    const fs = sh(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return false;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    this.u = {};
    ['uRes', 'uTime', 'uDepth', 'uMouse', 'uGrain', 'uPolish', 'uFlat', 'uTemp', 'uCore', 'uQuality', 'uPulse'].forEach((n) => {
      this.u[n] = gl.getUniformLocation(prog, n);
    });

    this.canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; document.documentElement.classList.add('no-gl'); });
    this.resize();
    window.addEventListener('resize', () => this.resize(), { passive: true });
    return true;
  }

  resize() {
    if (!this.gl) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(window.innerWidth * dpr * this.scale));
    const h = Math.max(1, Math.round(window.innerHeight * dpr * this.scale));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.gl.viewport(0, 0, w, h);
    }
  }

  set(values) { Object.assign(this.target, values); }

  pulse() { if (!this.reducedMotion) this.pulseT = 0; }

  render(dt) {
    if (!this.ok || this.lost) return;
    const gl = this.gl;
    const k = 1 - Math.pow(0.0018, dt); // frame-rate independent smoothing
    const c = this.cur, t = this.target;
    for (const key in t) c[key] += (t[key] - c[key]) * (key === 'depth' ? Math.min(1, k * 2) : k);

    if (!this.reducedMotion) this.time += dt;

    // adaptive resolution: if the first frames are slow, render smaller
    this.frames++;
    if (this.frames > 20 && this.frames < 240) {
      if (dt > 1 / 40) this.slow++;
      if (this.slow > 24 && this.scale > this.minScale) {
        this.scale = Math.max(this.minScale, this.scale * 0.78);
        this.slow = 0;
        this.resize();
      }
    }

    gl.uniform2f(this.u.uRes, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.u.uTime, this.time);
    gl.uniform1f(this.u.uDepth, c.depth);
    gl.uniform2f(this.u.uMouse, c.mx, c.my);
    gl.uniform4f(this.u.uGrain, c.gx, c.gy, c.gs, c.go);
    gl.uniform1f(this.u.uPolish, Math.max(0.01, Math.min(1, c.polish)));
    gl.uniform1f(this.u.uFlat, c.flat);
    gl.uniform1f(this.u.uTemp, c.temp);
    gl.uniform1f(this.u.uCore, c.core);
    gl.uniform1f(this.u.uQuality, this.mobile ? 0 : 1);
    if (this.pulseT < 1) this.pulseT = Math.min(1, this.pulseT + dt / 2.2);
    gl.uniform1f(this.u.uPulse, this.pulseT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
