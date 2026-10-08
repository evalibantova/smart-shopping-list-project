#!/usr/bin/env node
/**
 * screenshot-all.js
 * Takes screenshots of app routes at multiple viewport sizes.
 *
 * Routes are auto-discovered from the app's router (App.tsx path= attributes).
 * Pass --routes to override. Pass a bare path to capture only that route.
 *
 * Usage:
 *   node /tmp/screenshot-all.js                                — all routes, all viewports
 *   node /tmp/screenshot-all.js /shopping-list                 — one route, all viewports
 *   node /tmp/screenshot-all.js --vp mobile,tablet             — all routes, specific viewports
 *   node /tmp/screenshot-all.js /recipes --vp mobile,pc        — one route, specific viewports
 *   node /tmp/screenshot-all.js --routes /a,/b --vp notebook   — explicit routes, specific viewports
 *   node /tmp/screenshot-all.js --app /path/to/App.tsx         — alternate router file
 *   node /tmp/screenshot-all.js --port 5173                    — dev server port (default: 5173)
 *   node /tmp/screenshot-all.js --out /tmp/shots               — output directory (default: cwd/screenshots_<ts>)
 *
 * Viewport keys: mobile, tablet, notebook, pc, 4k
 */
const fs   = require('fs');
const path = require('path');
const os   = require('os');

// Resolve playwright-core without a hardcoded path.
// Checks local node_modules, then scans the npx cache.
const playwrightPath = (() => {
  try { return require.resolve('playwright-core'); } catch (_) {}
  const npxCache = path.join(os.homedir(), '.npm', '_npx');
  if (fs.existsSync(npxCache)) {
    for (const bucket of fs.readdirSync(npxCache)) {
      const candidate = path.join(npxCache, bucket, 'node_modules', 'playwright-core');
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  throw new Error('playwright-core not found. Run: npx playwright-core install');
})();
const { chromium } = require(playwrightPath);

const ALL_VIEWPORTS = [
  { key: 'mobile',   label: 'iPhone SE',  width: 375,  height: 667  },
  { key: 'tablet',   label: 'Tablet',     width: 768,  height: 1024 },
  { key: 'notebook', label: 'Notebook',   width: 1280, height: 800  },
  { key: 'pc',       label: 'PC',         width: 1920, height: 1080 },
  { key: '4k',       label: '4K',         width: 3840, height: 2160 },
];

// Parse routes from a React Router App file by extracting path="..." attributes.
// Skips wildcard (*) and redirect-only routes (no real content path).
function discoverRoutes(appFile) {
  const src = fs.readFileSync(appFile, 'utf8');
  const matches = [...src.matchAll(/path=["']([^"'*][^"']*)["']/g)];
  return matches
    .map(m => m[1])
    .filter(p => p && !p.includes('*'))
    .map(p => ({ route: p, name: p.replace(/^\//, '').replace(/\//g, '-') || 'home' }));
}

// Find App.tsx relative to cwd. No project-specific fallbacks.
function findAppFile(override) {
  if (override) return override;
  const candidates = [
    path.join(process.cwd(), 'src/App.tsx'),
    path.join(process.cwd(), 'src/App.jsx'),
  ];
  return candidates.find(f => fs.existsSync(f)) || null;
}

// Parse CLI args
const rawArgs = process.argv.slice(2);
let specificRoute  = null;
let vpFilter       = null;
let routesOverride = null;
let appFileOverride = null;
let port           = 5173;
let outOverride    = null;

for (let i = 0; i < rawArgs.length; i++) {
  const a = rawArgs[i];
  if      (a === '--vp'     && rawArgs[i + 1]) { vpFilter       = rawArgs[++i].split(',').map(s => s.trim().toLowerCase()); }
  else if (a === '--routes' && rawArgs[i + 1]) { routesOverride  = rawArgs[++i].split(',').map(s => s.trim()); }
  else if (a === '--app'    && rawArgs[i + 1]) { appFileOverride = rawArgs[++i]; }
  else if (a === '--port'   && rawArgs[i + 1]) { port            = parseInt(rawArgs[++i], 10); }
  else if (a === '--out'    && rawArgs[i + 1]) { outOverride     = rawArgs[++i]; }
  else if (!a.startsWith('--'))               { specificRoute   = a; }
}

const BASE_URL = `http://localhost:${port}`;

// Resolve routes
let routes;
if (specificRoute) {
  routes = [{ route: specificRoute, name: specificRoute.replace(/^\//, '').replace(/\//g, '-') || 'home' }];
} else if (routesOverride) {
  routes = routesOverride.map(r => ({ route: r, name: r.replace(/^\//, '').replace(/\//g, '-') || 'home' }));
} else {
  const appFile = findAppFile(appFileOverride);
  if (!appFile) {
    console.error('Could not find App.tsx/App.jsx in src/. Use --app <path> or --routes <paths>.');
    process.exit(1);
  }
  routes = discoverRoutes(appFile);
  if (routes.length === 0) {
    console.error(`No routes found in ${appFile}. Use --routes <paths> to specify them.`);
    process.exit(1);
  }
  console.log(`Routes discovered from: ${appFile}`);
}

// Resolve viewports
const viewports = vpFilter
  ? ALL_VIEWPORTS.filter(v => vpFilter.includes(v.key))
  : ALL_VIEWPORTS;

if (viewports.length === 0) {
  console.error(`No matching viewports for: ${vpFilter.join(', ')}`);
  console.error(`Valid keys: ${ALL_VIEWPORTS.map(v => v.key).join(', ')}`);
  process.exit(1);
}

// Output folder — cwd-relative by default
const ts     = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
const outDir = outOverride || path.join(process.cwd(), `screenshots_${ts}`);
fs.mkdirSync(outDir, { recursive: true });

const browserEnv = { ...process.env, FONTCONFIG_FILE: '/tmp/chrome-fonts.conf', DISPLAY: '' };

(async () => {
  console.log(`Output folder: ${outDir}`);
  console.log(`Base URL:  ${BASE_URL}`);
  console.log(`Routes:    ${routes.map(r => r.route).join(', ')}`);
  console.log(`Viewports: ${viewports.map(v => `${v.key} (${v.width}x${v.height})`).join(', ')}\n`);

  const browser = await chromium.launch({
    headless: true,
    env: browserEnv,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox',
      '--disable-dev-shm-usage', '--disable-gpu',
      '--no-zygote', '--single-process',
      '--disable-software-rasterizer', '--font-render-hinting=none',
    ],
  });

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page    = await context.newPage();
  const results = [];

  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });

    for (const { route, name } of routes) {
      const file = path.join(outDir, `${name}_${vp.key}.png`);
      try {
        await page.goto(`${BASE_URL}${route}`, { waitUntil: 'load', timeout: 20000 });
        await page.screenshot({ path: file });
        console.log(`✓ ${name}_${vp.key}.png  [${vp.label} ${vp.width}x${vp.height}]`);
        results.push({ name, vp: vp.key, file, ok: true });
      } catch (e) {
        console.error(`✗ ${name}@${vp.key}: ${e.message}`);
        results.push({ name, vp: vp.key, file, ok: false });
      }
    }
  }

  await browser.close();

  const ok = results.filter(r => r.ok).length;
  console.log(`\nDone. ${ok}/${results.length} saved to ${outDir}`);
  results.filter(r => r.ok).forEach(r => console.log(`  ${r.file}`));
})().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
