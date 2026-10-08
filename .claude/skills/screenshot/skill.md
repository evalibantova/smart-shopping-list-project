---
name: screenshot
description: 'Takes screenshots of the running dev server and displays them. Routes are auto-discovered from the app router. By default captures all routes at all 5 responsive viewports; pass a route and/or --vp to narrow the capture. Use when the user asks to see the app, check the UI, or verify a visual change. Fully autonomous — no manual steps.'
---

# Screenshot Skill

Capture screenshots of the app and read them back visually.

## Parameters

All parameters are optional and combinable:

- **Bare path** (e.g. `/pantry`) — capture only that route. Omit to capture all discovered routes.
- **`--vp <keys>`** — comma-separated viewport keys. Omit to capture all viewports.
- **`--routes <paths>`** — comma-separated explicit paths, overrides auto-discovery.
- **`--app <file>`** — path to the router file if not auto-found.
- **`--port <n>`** — dev server port (default: `5173`, Vite's default).
- **`--out <dir>`** — output directory (default: `screenshots_<timestamp>` under cwd).

Viewport keys: `mobile`, `tablet`, `notebook`, `pc`, `4k`

| Key      | Device    | Size      |
|----------|-----------|-----------|
| mobile   | iPhone SE | 375×667   |
| tablet   | Tablet    | 768×1024  |
| notebook | Notebook  | 1280×800  |
| pc       | PC        | 1920×1080 |
| 4k       | 4K screen | 3840×2160 |

Routes are auto-discovered by parsing `path=` attributes from the app's router file (`src/App.tsx` or `src/App.jsx` relative to cwd). No routes are hardcoded in this skill.

Screenshots are saved to `screenshots_YYYY-MM-DD_HH-MM-SS/` under the current working directory (or the path given with `--out`).
Files are named `{route}_{viewport}.png` (e.g. `recipes_mobile.png`).

## Steps

1. **Check if the Playwright libs are installed:**
   ```bash
   node -e "const fs=require('fs'); process.exit(fs.existsSync('/tmp/chrome-libs/usr/lib/x86_64-linux-gnu/libX11.so.6') ? 0 : 1);"
   ```

2. **If libs are missing (exit code 1)** — run one-time setup first:
   ```bash
   node /tmp/install-chrome-libs.js
   ```

3. **Run the screenshot script** (combine parameters as needed):

   All routes, all viewports (on default port 5173):
   ```bash
   LD_LIBRARY_PATH=/tmp/chrome-libs/usr/lib/x86_64-linux-gnu:/tmp/chrome-libs/usr/lib FONTCONFIG_FILE=/tmp/chrome-fonts.conf node /tmp/screenshot-all.js
   ```

   One route, all viewports:
   ```bash
   LD_LIBRARY_PATH=/tmp/chrome-libs/usr/lib/x86_64-linux-gnu:/tmp/chrome-libs/usr/lib FONTCONFIG_FILE=/tmp/chrome-fonts.conf node /tmp/screenshot-all.js /pantry
   ```

   All routes, specific viewports:
   ```bash
   LD_LIBRARY_PATH=/tmp/chrome-libs/usr/lib/x86_64-linux-gnu:/tmp/chrome-libs/usr/lib FONTCONFIG_FILE=/tmp/chrome-fonts.conf node /tmp/screenshot-all.js --vp mobile,tablet
   ```

   One route, specific viewports, non-default port:
   ```bash
   LD_LIBRARY_PATH=/tmp/chrome-libs/usr/lib/x86_64-linux-gnu:/tmp/chrome-libs/usr/lib FONTCONFIG_FILE=/tmp/chrome-fonts.conf node /tmp/screenshot-all.js /recipes --vp mobile,pc --port 5176
   ```

   The script prints the output folder path and each saved filename.

4. **Read each PNG** using the Read tool and report what you see — layout, content, any issues. Group observations by viewport when multiple are captured.

## Environment Limitations

> **Why all this complexity?** Claude Code runs inside a locked-down container where normal browser access, Python GUI libs, debug/remote-DevTools connections to outside processes, and third-party skill installation are all unavailable. There is no `google-chrome`, no `python -m playwright`, no Xvfb, no way to open a browser window or attach to one running on the host, and no package manager or registry to pull in a pre-built screenshot skill. The workarounds below are the result of having to bootstrap a headless Chromium entirely from within the container using only Node.js and downloaded Debian packages.

### Platform
- **Linux x86_64 only.** The library installer downloads Debian `amd64` packages and the Playwright binary is `chrome-headless-shell-linux64`. This skill does not work on ARM, macOS, or Windows (even WSL on ARM).

### No display server
- The container has no X server or Wayland compositor. Chrome runs with `DISPLAY=''` and the flags `--no-sandbox --single-process --disable-gpu --no-zygote`. These are hard requirements, not optimisations.

### Single-process mode side-effects
`--single-process` is needed to avoid the Zygote process launcher (not available without sandbox). Known consequences:
- Web Workers and SharedArrayBuffer are disabled.
- Heavy pages or slow JS may time out (20 s limit per route).
- CSS animations capture at whatever frame the `load` event fires — animated state is not guaranteed.
- iframes and cross-origin content may not render.

### System libraries must be bootstrapped
The container lacks the X11/NSS/ATK/GBM libraries Chromium needs. `install-chrome-libs.js` downloads ~30 Debian packages from `deb.debian.org` (Debian 13 "trixie", amd64) and extracts them to `/tmp/chrome-libs/`. This requires outbound HTTP access. If the Debian mirror is unreachable the setup will fail.

### `/tmp/` is ephemeral
Everything in `/tmp/` — `chrome-libs/`, `chrome-fonts.conf`, `screenshot-all.js` — is wiped on container restart. Re-run the lib setup after each restart. The `.deb` files are cached in `/tmp/chrome-debs/` within a session, so a second setup call in the same session is fast; across restarts it re-downloads.

### playwright-core is not a project dependency
playwright-core is installed via `npx` and lives in `~/.npm/_npx/<hash>/`. The hash changes when npx or playwright-core is upgraded. The script resolves it dynamically — if resolution fails, run `npx playwright-core install` to repopulate the cache.

### Font rendering
Fonts come from the extracted Debian packages (`fonts-dejavu-core`), not from the system font stack. Text rendering will differ from a real browser on the same host. Custom fonts loaded via `@font-face` from a CDN will render correctly only if the dev server is running and the network is reachable.

### Route discovery scope
Auto-discovery reads `path="…"` JSX attributes from `src/App.tsx` or `src/App.jsx`. It will **not** discover:
- Next.js / Remix file-based routes
- Vue Router, Angular Router
- Routes defined as plain JS objects (not JSX props)
- Dynamic segments (`:id`, `[slug]`) — these are skipped by the wildcard filter
Use `--routes` to specify paths explicitly in those cases.

### Screenshots only — no interaction
The skill captures static screenshots at page load. It cannot click, type, scroll, or hover. Auth-gated pages won't render unless the app provides a dev/seed bypass. Lazy-loaded content below the fold is not captured.

### Viewport simulation
Only `width` and `height` are set. There is no touch emulation, device pixel ratio override, or mobile user-agent spoofing. Layouts that depend on those (e.g. `hover` media queries, DPR-dependent images) may look different from a real device.

## Notes

- All Bash commands are pre-approved in `.claude/settings.local.json` — no permission prompts.
- The canonical source of `screenshot-all.js` lives in this skill directory (`skills/screenshot/screenshot-all.js`). If `/tmp/screenshot-all.js` is missing after a restart, copy it from there rather than regenerating it.
