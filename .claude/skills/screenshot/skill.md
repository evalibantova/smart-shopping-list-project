---
name: screenshot
description: 'Takes screenshots of the running dev server (localhost:5173) and displays them. Routes are auto-discovered from the app router. By default captures all routes at all 5 responsive viewports; pass a route and/or --vp to narrow the capture. Use when the user asks to see the app, check the UI, or verify a visual change. Fully autonomous — no manual steps.'
---

# Screenshot Skill

Capture screenshots of the app and read them back visually.

## Parameters

All parameters are optional and combinable:

- **Bare path** (e.g. `/pantry`) — capture only that route. Omit to capture all discovered routes.
- **`--vp <keys>`** — comma-separated viewport keys. Omit to capture all viewports.
- **`--routes <paths>`** — comma-separated explicit paths, overrides auto-discovery.
- **`--app <file>`** — path to the router file if not auto-found.

Viewport keys: `mobile`, `tablet`, `notebook`, `pc`, `4k`

| Key      | Device    | Size      |
|----------|-----------|-----------|
| mobile   | iPhone SE | 375×667   |
| tablet   | Tablet    | 768×1024  |
| notebook | Notebook  | 1280×800  |
| pc       | PC        | 1920×1080 |
| 4k       | 4K screen | 3840×2160 |

Routes are auto-discovered by parsing `path=` attributes from the app's router file (`src/App.tsx` or `src/App.jsx`). No routes are hardcoded in this skill.

Screenshots are saved to `/data/screenshots_YYYY-MM-DD_HH-MM-SS/`.
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

   All routes, all viewports:
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

   One route, specific viewports:
   ```bash
   LD_LIBRARY_PATH=/tmp/chrome-libs/usr/lib/x86_64-linux-gnu:/tmp/chrome-libs/usr/lib FONTCONFIG_FILE=/tmp/chrome-fonts.conf node /tmp/screenshot-all.js /recipes --vp mobile,pc
   ```

   The script prints the output folder path and each saved filename.

4. **Read each PNG** using the Read tool and report what you see — layout, content, any issues. Group observations by viewport when multiple are captured.

## Notes

- All Bash commands are pre-approved in `.claude/settings.local.json` — no permission prompts.
- `/tmp/` is ephemeral; re-run setup after a container restart (`.deb` downloads are cached, so it's fast).
- The script uses a single browser context and resizes the page per viewport for compatibility with `--single-process`.
