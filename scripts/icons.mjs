/* Makes the app icons: the wolf in light, dark and each theme's colours, plus a one-colour version for
   Android's themed icons, and a web app manifest per variant. Run after changing the wolf or a theme:
     node scripts/icons.mjs
   Output (committed): public/icons/<variant>-{180,192,512,maskable}.png, public/icons/monochrome.png and
   public/manifests/<variant>.webmanifest. public/theme.js picks the variant on each page. */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { THEMES } from '../src/data/themes.js';

const RED = '#e8261a';
/* light and dark are the plain icons (white or black behind the wolf); every other theme uses its own
   background, its text colour for the wolf, and its accent for the eyes (red where the accent is the text) */
const VARIANTS = { light: { bg: '#ffffff', fg: '#0b0b0b', eye: RED }, dark: { bg: '#0b0b0b', fg: '#ffffff', eye: RED } };
for (const t of THEMES) if (!['auto', 'light', 'dark'].includes(t.id)) VARIANTS[t.id] = { bg: t.c[0], fg: t.c[2], eye: t.c[3].toLowerCase() === t.c[2].toLowerCase() ? RED : t.c[3] };

const WOLF = 'M200 142 L258 128 L292 56 L312 162 L340 196 L318 204 L330 232 L252 304 L200 358 L148 304 L70 232 L82 204 L60 196 L88 162 L108 56 L142 128 Z';
const EYES = 'M212 220 L280 188 L268 212 Z M188 220 L120 188 L132 212 Z', NOSE = 'M186 290 L214 290 L200 304 Z';
/* square and full-bleed: iOS and Android round the corners themselves. A maskable icon keeps the wolf inside
   the central safe zone. */
const svg = ({ bg, fg, eye }, scale) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="${bg}"/><g transform="translate(200 207) scale(${scale}) translate(-200 -207)"><path d="${WOLF}" fill="${fg}" stroke="${fg}" stroke-width="16" stroke-linejoin="miter"/><path fill="${eye}" d="${EYES}"/><path fill="${bg}" d="${NOSE}"/></g></svg>`;
/* only the shape counts for a themed icon: the wolf with its eyes and nose cut out, on nothing */
const mono = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><mask id="m"><rect width="400" height="400" fill="#fff"/><path d="${EYES} ${NOSE}" fill="#000"/></mask><g transform="translate(200 207) scale(.6) translate(-200 -207)"><path d="${WOLF}" fill="#fff" stroke="#fff" stroke-width="16" stroke-linejoin="miter" mask="url(#m)"/></g></svg>`;

const browser = await chromium.launch(), page = await browser.newPage();
async function png(markup, size, file, transparent = false) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${markup}`);
  writeFileSync(file, await page.screenshot({ omitBackground: transparent }));
}
mkdirSync('public/icons', { recursive: true }); mkdirSync('public/manifests', { recursive: true });
const base = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));
for (const [id, v] of Object.entries(VARIANTS)) {
  for (const n of [180, 192, 512]) await png(svg(v, 0.8), n, `public/icons/${id}-${n}.png`);
  await png(svg(v, 0.62), 512, `public/icons/${id}-maskable.png`);
  const icons = [
    { src: `/icons/${id}-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: `/icons/${id}-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: `/icons/${id}-maskable.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    { src: '/icons/monochrome.png', sizes: '512x512', type: 'image/png', purpose: 'monochrome' }
  ];
  writeFileSync(`public/manifests/${id}.webmanifest`, JSON.stringify({ ...base, background_color: v.bg, theme_color: v.bg, icons }, null, 2) + '\n');
}
await png(mono, 512, 'public/icons/monochrome.png', true);
await browser.close();
console.log(`${Object.keys(VARIANTS).length} variants`);
