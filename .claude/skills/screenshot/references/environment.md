# Screenshot skill: environment notes and limitations

Read this when a capture fails, looks wrong, or the user asks why the setup is so involved.

## Why the setup is involved

Claude Code runs in a locked-down container. There is no `google-chrome`, no `python -m playwright`, no Xvfb, and no way to attach to a browser on the host. `scripts/install-chrome-libs.js` therefore bootstraps headless Chromium from Node.js plus downloaded Debian packages.

## Platform

- **Linux x86_64 only.** The installer downloads Debian `amd64` packages and Playwright uses `chrome-headless-shell-linux64`. It does not work on ARM, macOS or Windows.
- **No display server.** Chrome runs with `DISPLAY=''` and `--no-sandbox --single-process --disable-gpu --no-zygote`. These flags are required, not optimisations.

## Single-process side effects

`--single-process` avoids the Zygote launcher, which needs the sandbox. Consequences:
- Web Workers and SharedArrayBuffer are disabled.
- Heavy pages or slow JS may hit the 20 s per-route timeout.
- CSS animations are captured at whatever frame follows `load`; animated state is not guaranteed.
- iframes and cross-origin content may not render.

## System libraries

The container lacks the X11/NSS/ATK/GBM libraries Chromium needs. The installer downloads ~38 packages from `deb.debian.org` (Debian 13 "trixie", amd64) and extracts them to `/tmp/chrome-libs/`. It needs outbound HTTP; if the mirror is unreachable, setup fails.

- Several libs were renamed with a `t64` suffix in trixie (e.g. `libglib2.0-0t64`). The installer already uses the right names.
- `Packages.gz` is too large to pipe through `execSync` (ENOBUFS), so the installer decompresses it to `/tmp/Packages.txt` first. Keep it that way.

## `/tmp/` is ephemeral

`chrome-libs/`, `chrome-fonts.conf` and cached `.deb` files in `/tmp/chrome-debs/` vanish on container restart. Re-run the installer after each restart. Within a session the cached debs make a second run fast.

## playwright-core

It is not a project dependency. The script uses `require.resolve('playwright-core')` and then scans `~/.npm/_npx/<hash>/node_modules`. The hash changes when npx or playwright-core is upgraded. If resolution fails, run `npx playwright-core install` to repopulate the cache.

## Fonts

Fonts come from the extracted `fonts-dejavu-core` package, not the host. Text will differ from a real browser. CDN `@font-face` fonts render only if the network is reachable.

## Route discovery scope

Discovery reads `path="…"` JSX attributes from `src/App.tsx` or `src/App.jsx`. It does not find Next.js/Remix file routes, Vue/Angular routers, routes defined as plain JS objects, or dynamic segments (`:id`, `[slug]`). Use `--routes` for those.

## Static captures only

The script screenshots at page load. It cannot click, type, scroll or hover, and auth-gated pages render only if the app has a dev/seed bypass. Below-the-fold lazy content is not captured. Only width and height are set: no touch emulation, DPR override or mobile user-agent, so hover media queries and DPR-dependent images may differ from a real device.

## Timing: why there is an 800 ms wait

`waitUntil: 'load'` fires before React `useEffect` runs. Pages that load data in an effect (e.g. from localStorage into a store) would be captured empty. The script waits 800 ms after navigation. If pages still look empty, increase the delay; do not remove it.

## Checking whether the dev server is up

`ss` is not available. Vite may listen on IPv6 only (`::1`), so probe both loopback addresses; a check against `localhost` alone can report DOWN while the page is reachable:
```bash
node -e "Promise.any(['127.0.0.1','[::1]'].map(h=>fetch('http://'+h+':5173'))).then(()=>console.log('UP'),()=>console.log('DOWN'))"
```
