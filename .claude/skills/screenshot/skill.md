---
name: screenshot
description: Takes screenshots of the running dev server and displays them. Routes are auto-discovered from the app router. By default captures all routes at all 5 responsive viewports; pass a route and/or --vp to narrow the capture. Use whenever the user asks to see the app, check the UI, look at a page, or verify a visual or layout change (including responsive/mobile checks), even if they don't say "screenshot". Fully autonomous, no manual steps.
---

# Screenshot

Capture screenshots of the running app, then read them back visually and report what you see.


## Parameters

All optional and combinable:

- **Bare path** (e.g. `/pantry`): capture only that route. Omit to capture every discovered route.
- `--vp <keys>`: comma-separated viewport keys. Omit for all.
- `--routes <paths>`: comma-separated explicit paths; overrides auto-discovery.
- `--app <file>`: router file, if not at `src/App.tsx` / `src/App.jsx` under cwd.
- `--port <n>`: dev server port (default `5173`).
- `--out <dir>`: output directory (default `screenshots_<timestamp>` under cwd).

| Key      | Device    | Size     |
|----------|-----------|----------|
| mobile   | iPhone SE | 375×667  |
| tablet   | Tablet    | 768×1024 |
| notebook | Notebook  | 1280×800 |
| pc       | PC        | 1920×1080 |
| 4k       | 4K screen | 3840×2160 |

Files are named `{route}_{viewport}.png` (e.g. `recipes_mobile.png`; `/` becomes `home`).

## Steps

1. **Make sure the dev server is up** on the target port (it is not started for you). Check with the one-liner in `references/environment.md`; if it is down, start it or ask the user.

2. **Install the browser libs if missing.** Chromium needs system libraries that the container lacks; the installer fetches them into `/tmp/chrome-libs` (wiped on container restart). Check first, and run the installer only if the check exits 1. Keep these as two separate commands; chained ones get blocked by the permission system:
   ```bash
   node -e "process.exit(require('fs').existsSync('/tmp/chrome-libs/usr/lib/x86_64-linux-gnu/libX11.so.6') ? 0 : 1)"
   ```
   ```bash
   node /data/.claude/skills/screenshot/scripts/install-chrome-libs.js
   ```

3. **Run the capture**, adding parameters as needed:
   ```bash
   LD_LIBRARY_PATH=/tmp/chrome-libs/usr/lib/x86_64-linux-gnu:/tmp/chrome-libs/usr/lib \
   FONTCONFIG_FILE=/tmp/chrome-fonts.conf \
   node /data/.claude/skills/screenshot/scripts/screenshot-all.js [/route] [--vp mobile,tablet] [--port 5176]
   ```
   Run it from the app's project root (`code/` in this repo) so route discovery finds `src/App.tsx`. The script prints the output folder and each saved file.

4. **Read each PNG** with the Read tool and report layout, content and any issues, grouped by viewport when there are several.

## When something goes wrong

Failed captures, empty-looking pages, missing routes, and font or animation oddities are usually environment limits rather than app bugs. Read `references/environment.md` before debugging. The most common cases:

- **Page looks empty:** data loads in a `useEffect`; raise the 800 ms wait in `screenshot-all.js` (never remove it).
- **`playwright-core not found`:** run `npx playwright-core install`.
- **Dynamic or non-JSX routes not found:** pass `--routes`.
- **Pantry/shopping list look empty:** a fresh headless browser has no localStorage data, so stock colours and populated lists can't be seen. Say so in the report rather than concluding nothing changed.
- **Captures are static:** no clicking, hovering or scrolling; auth-gated pages need a dev bypass.
