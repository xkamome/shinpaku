# 心白 SHINPAKU

An immersive introduction to Japanese sake (日本酒), written in Traditional Chinese with Japanese annotations.
The page is a descent — surface (basics) → middle (labels) → deep (numbers, terroir, temperature) → core —
mirroring how a sake rice grain is polished down to its starchy heart, the *shinpaku* (心白).

Live: https://xkamome.github.io/shinpaku/

## Structure

- `index.html` — all content
- `assets/js/scene.js` — WebGL background and the raymarched rice grain (polish ratio, flat milling, temperature, core glow)
- `assets/js/main.js` — smooth scroll, reveals, the polish-ratio gauge, and "stages" the grain tracks
- `assets/js/interactives.js` — flavour quadrant, grade slider, label hotspots, SMV × acidity chart, milling shapes, temperature
- `assets/fonts/` + `assets/css/fonts.css` — self-hosted fonts, subset to the characters on the page

No build step. Serve the folder with any static server.

## After editing copy

Fonts are subset to the page's characters, so regenerate them whenever text changes:

```
node tools/fonts.mjs
```

## Checks

- `node tools/verify.mjs` — static checks (also runs in CI)
- `cd qa && npm i && node check.mjs <name>` — desktop / mobile / reduced-motion screenshots, console errors, overflow, axe-core, FPS
- `cd qa && node interact.mjs <name>` — drives every interactive and prints the resulting states

## Sources

Japanese NTA labelling standard for sake; 佐藤信 et al. (1974) for the 甘辛度・濃淡度 formulas; Hiroshima Prefecture on flat milling;
the oral-history survey 《ベテラン杜氏聞き書き調査》 (2023–2024) for the brewers' quotes, presented as traditional perspectives rather than current standards.
