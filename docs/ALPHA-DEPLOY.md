# Alpha v0.1 Deploy Tracker

Goal: ship the first alpha (frontend-only SPA, localStorage data) to shared hosting.

## Decisions
- URL: `https://shopping.chillimuffin.com` (subdomain root; vite `base: '/'`, `code/public/.htaccess` SPA fallback as is)
- Upload: manual FTP client, uploading `code/dist/` contents
- Quality gate: lint and tests must pass before release
- No backend for alpha. The cookbook seed is bundled into the JS.

## Checklist

Legend: [x] done, [~] partly done, [ ] not started

| # | Step | Status | Notes |
|---|------|--------|-------|
| 1 | Commit pending work (meal-planner orphan removal, week-range year fix, tests) | [x] | Already committed (971ba4a, 946eeba) |
| 2 | Fix gate: lint error, `cookNowUtils` tests, flaky `IngredientAutocomplete` tests | [x] | Removed unused `_context` in `RecipeDetail.tsx`. The cookNow tests were stale (code now treats up to 4 missing as "almost"), so I updated them and added a "far" case. `IngredientAutocomplete` passed on re-run, and the earlier failures looked load-related (the suite takes about 2 minutes). Lint: 0 errors, 5 warnings. |
| 3 | Pre-deploy hygiene: rollup linux dep, freeze `IMPORT_VERSION`, doc mismatches | [x] | Removed `@rollup/rollup-linux-x64-gnu` from dependencies and re-synced the lockfile. `IMPORT_VERSION` is '8' and stays frozen for the alpha. STACK.md versions corrected. |
| 4 | Production build + local preview check | [x] | Build passes. `dist/` has index.html, assets/, .htaccess. Preview click-through confirmed OK by Eva. |
| 5 | Hosting prerequisites: (sub)domain, HTTPS, mod_rewrite/AllowOverride, FTP details | [ ] | You do this, I guide. Keep credentials out of the repo. |
| 6 | Upload `dist/` contents (including hidden `.htaccess`) | [ ] | |
| 7 | Smoke test on live site | [ ] | |
| 8 | Record release: tag `alpha-0.1`, update CONTEXT.md, logbook.md | [ ] | |

## Access protection (HTTP Basic Auth)
- `code/public/.htaccess` carries the auth block (realm "Chilli Muffin", `AuthUserFile /var/www25/p66385/chillimuffin.com/sub/shopping/.htpasswd`). It is committed and ships in `dist/`.
- `.htpasswd` is generated locally and never committed. It currently lives in `deploy/` (gitignored); the plan is to keep it in `code/dist/` (also gitignored) once the move is done. User `chilli`, simple password given to Eva in chat. Change it before sharing wider: `openssl passwd -apr1 'newpass'`.
- `npm run build` wipes `dist/`, so the `.htpasswd` must be re-created after every rebuild: `printf 'chilli:%s\n' "$(openssl passwd -apr1 'PASSWORD')" > code/dist/.htpasswd`. It only needs re-uploading if it changed, but the FTP client should not delete it.
- If `.htpasswd` is missing on the server, Apache returns 500 for every request.

## Uncommitted changes (to commit together)
`code/package.json`, `code/package-lock.json`, `code/src/__tests__/cookNowUtils.test.ts`, `code/src/components/shared/RecipeDetail.tsx`, `docs/STACK.md`, `docs/ALPHA-DEPLOY.md`, `AGENTS.md`.
Not part of this: `.claude/settings.local.json`, `bugs/`, `design-v2/` (untracked, not mine, left alone).

## Open questions
- Subdomain `shopping.chillimuffin.com` is chosen. Still to confirm: it is created, its docroot path, HTTPS is on, `mod_rewrite` works.

## Known issues
- Bumping `IMPORT_VERSION` wipes tester data, so keep it frozen during the alpha.
- JS bundle is about 797 kB (236 kB gzipped). Not blocking.
- 5 lint warnings remain (react-refresh and hooks-deps). Not blocking.
- `BACKEND-STACK.md` says "no SSH" while `CONTEXT.md` says "FTP only". Irrelevant for the alpha.

## Log
- 2026-10-13: tracker created, plan agreed.
- 2026-10-13: steps 1-3 done, build passes. Committed as 7959311.
- 2026-10-13: step 4 done, local preview confirmed OK. Next: hosting prerequisites (step 5).
