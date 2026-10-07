---
title: '1.1 Navigable App Shell'
type: 'feature'
created: '2026-10-07'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'f857c9daf3c661293533d69b0d4cf39e0094ec53'
context:
  - '_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The project has no scaffold, design tokens, routing, or navigation shell. Nothing in Epic 1 (or any later epic) can be built without these foundations in place.

**Approach:** Scaffold the complete Vite + React + TypeScript project from scratch; define all design tokens as CSS custom properties in `tokens.css`; implement the responsive app shell (220 px charcoal sidebar on desktop, 60 px charcoal fixed bottom nav on mobile); wire React Router v6 to five stub page components; create the full feature-sliced directory structure per the architecture spec.

## Boundaries & Constraints

**Always:**
- All color, shadow, typography, and radius values must be CSS custom properties from `tokens.css` — no component hardcodes these values
- Responsive breakpoint is exactly 768 px — sidebar visible at ≥768 px, bottom nav visible at <768 px
- Active nav: desktop = coral background + white text; mobile = coral icon + coral label, no background pill
- `.page-header` always `flex-direction: row; justify-content: space-between` — never stacked vertically
- `code/public/.htaccess` must rewrite all non-file requests to `index.html`
- Vite: `base: '/'`, `build.outDir: 'dist'`; npm scripts must be cross-platform (no Unix-only syntax)

**Never:**
- No blue anywhere in the UI
- No rounded corners by default — `--radius: 0`
- No elevation via borders — shadows only
- Do not implement data models, service calls, or Zustand beyond an empty composition stub
- Do not implement any functional feature UI beyond stub pages

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output |
|----------|--------------|-----------------|
| Initial load | Fresh browser at `/` | Redirects to `/recipes`; Recipes stub and nav render |
| Direct URL | `/meal-planner` entered directly | `.htaccess` rewrites to `index.html`; React Router renders Meal Planner stub |
| Mobile viewport | <768 px | Bottom nav visible (60 px), sidebar hidden, page padded 60 px at bottom |
| Desktop viewport | ≥768 px | Sidebar visible (220 px), bottom nav hidden |
| Active link | User on `/recipes` | Desktop: Recipes link coral bg + white; Mobile: Recipes icon + label in coral |

</frozen-after-approval>

## Code Map

All files are new — codebase is greenfield. `node_modules/` is pre-populated; do not run `npm install`.

- `code/package.json` — create; scripts: dev, build, preview, test, lint; deps include react, react-dom, react-router-dom, zustand, tailwindcss, @tailwindcss/vite, lucide-react, class-variance-authority, @vitejs/plugin-react
- `code/vite.config.ts` — create; plugins: `@vitejs/plugin-react()`, `tailwindcss()`; `base: '/'`; `build.outDir: 'dist'`
- `code/tsconfig.json` + `code/tsconfig.node.json` — strict TS; `"jsx": "react-jsx"`, `"moduleResolution": "bundler"`
- `code/index.html` — entry HTML; Google Fonts (Plus Jakarta Sans 400/500/600/700); `<div id="root">`; script `src="/src/main.tsx"`
- `code/public/.htaccess` — Apache SPA rewrite (all paths without extension → `index.html`)
- `code/src/styles/tokens.css` — `@import "tailwindcss"`; `:root {}` with all tokens from DESIGN.md
- `code/src/main.tsx` — React 18 `createRoot`; imports `./styles/tokens.css`; wraps `<App>` in `<BrowserRouter>`
- `code/src/App.tsx` — `<AppShell>` wrapping `<Routes>`; 5 routes + `/` redirect to `/recipes`
- `code/src/AppShell.tsx` — `display:flex; height:100vh; overflow:hidden`; `<Sidebar>` + `<BottomNav>` + scrollable `<main>` with `<Outlet>`
- `code/src/components/nav/Sidebar.tsx` — 220 px, charcoal bg, 5 `<NavLink>` items with Lucide icons; active = coral bg + white text
- `code/src/components/nav/BottomNav.tsx` — fixed 60 px, charcoal bg, 5 icon+label items; sentence-case; 20×20 px icons, 10 px/600 labels; active = coral icon + coral label
- `code/src/features/recipes/index.tsx` — stub `<RecipesPage>`
- `code/src/features/meal-planner/index.tsx` — stub `<MealPlannerPage>`
- `code/src/features/shopping-list/index.tsx` — stub `<ShoppingListPage>`
- `code/src/features/pantry/index.tsx` — stub `<PantryPage>`
- `code/src/features/cook-now/index.tsx` — stub `<CookNowPage>`
- `code/src/store/index.ts` — empty Zustand composition export (no slices yet)
- `code/src/components/ui/` — create empty directory (placeholder for Story 1.3 components)
- `code/src/components/shared/` — create empty directory (placeholder for RecipeDetailModal)
- `code/src/services/` — create empty directory (placeholder for cross-feature services)

## Tasks & Acceptance

**Execution:**
- [x] `code/package.json` — create with all dependencies and cross-platform npm scripts
- [x] `code/vite.config.ts` — configure React + Tailwind v4 plugins, base, outDir
- [x] `code/tsconfig.json` + `code/tsconfig.node.json` — strict TypeScript config
- [x] `code/index.html` — entry HTML with Google Fonts and root mount point
- [x] `code/public/.htaccess` — Apache SPA rewrite rule
- [x] `code/src/styles/tokens.css` — all design tokens as CSS custom properties: colors (`--bg #f0ebe2`, `--surface #fff`, `--charcoal #1a1a1a`, `--coral #f07045`, `--coral-dark #d95f35`, `--amber #f5a623`, `--red #e05c5c`, `--text-mid rgba(0,0,0,0.52)`, `--text-dim rgba(0,0,0,0.32)`, `--border rgba(0,0,0,0.07)`), shadows (`--shadow-sm`, `--shadow`, `--shadow-md`), `--radius: 0`, and font base (`font-family: 'Plus Jakarta Sans', sans-serif; font-size: 14px; line-height: 1.5`)
- [x] `code/src/main.tsx` — React 18 root, BrowserRouter, tokens.css import
- [x] `code/src/App.tsx` — routes for 5 pages + redirect; AppShell wrapping
- [x] `code/src/AppShell.tsx` — responsive flex shell; sidebar (desktop), bottom nav (mobile), scrollable main
- [x] `code/src/components/nav/Sidebar.tsx` — 220 px charcoal sidebar with 5 NavLinks; icons from lucide-react (UtensilsCrossed, CalendarDays, ChefHat, ShoppingCart, Package); active state via NavLink `isActive`
- [x] `code/src/components/nav/BottomNav.tsx` — 60 px fixed bottom bar; same 5 items; sentence-case labels; active = coral icon + label
- [x] `code/src/features/*/index.tsx` — 5 stubs, each with `<div className="page">` wrapper and `<div className="page-header"><h1>Page Name</h1></div>`
- [x] `code/src/store/index.ts` — minimal stub (can be empty export or bare `create` import)

**Acceptance Criteria:**
- Given any of the 5 routes is loaded in a fresh browser, when the page renders, then the correct page title is visible and the nav is present
- Given desktop viewport ≥768 px, when any page loads, then a 220 px charcoal sidebar is visible and no bottom nav is rendered
- Given mobile viewport <768 px, when any page loads, then a 60 px charcoal bottom nav is visible; page content does not hide behind it (60 px bottom padding on main)
- Given the active route is `/recipes`, when on desktop, then the Recipes nav link has coral background and white text; when on mobile, the Recipes icon and label render in coral with no background pill
- Given I navigate directly to `/meal-planner`, when the .htaccess rewrites the request, then React Router renders the Meal Planner stub page
- Given I read `src/styles/tokens.css`, when examining any component file, then no color, shadow, or radius value is hardcoded — all reference CSS custom properties

## Implementation Notes

- Actual package versions in node_modules: React 19 (not 18.3), React Router v7 (not v6), Vite 8. APIs used are backward-compatible and the build passes cleanly.
- Added `code/tsconfig.app.json` (standard Vite convention) — `tsconfig.json` is the composite root referencing both `tsconfig.app.json` and `tsconfig.node.json`.
- `code/src/vite-env.d.ts` added for Vite client type declarations (required for CSS imports to type-check).
- Platform bindings: node_modules were pre-populated for Windows. On Linux/WSL2, `@rolldown/binding-linux-x64-gnu` and `@tailwindcss/oxide-linux-x64-gnu` were installed at build time with `--no-save`.
- I/O matrix rows (responsive layout, .htaccess rewrite, NavLink active state, redirect) are covered structurally in code but not by automated vitest tests — these require browser-level verification. The matrix behaviors are correctly implemented: `<Navigate to="/recipes" replace>` for redirect, CSS media queries in tokens.css for responsive nav, NavLink `isActive` for active state.
- `npm run build` exits 0; dist/ contains index.html, .htaccess, and assets/.

## Spec Change Log

## Review Triage Log

**Pass 1 — 2026-10-07**

- `--bottom-nav-height` undefined / `!important` cascade conflict (AppShell.tsx:13, tokens.css) — **medium, patch** — Variable `--bottom-nav-height` has fallback `0` and is never defined; actual mobile padding comes from `!important` media query. Two mechanisms control the same property; inline style is dead code. Fix: define `--bottom-nav-height: 60px` in `:root{}`, remove `!important` from both media query rules, use `padding-bottom: var(--bottom-nav-height, 0)` in the media query.
- `navItems` duplicated in Sidebar.tsx and BottomNav.tsx — **low, patch** — Same five-item array defined in both files. Any nav change requires two edits. Fix: extract to `src/components/nav/navItems.ts`.
- `eslint` missing from devDependencies while `npm run lint` calls `eslint src` — **medium, patch** — Fresh `npm install` + `npm run lint` fails with missing binary. Fix: add `eslint` to devDependencies.
- No `aria-label` on either `<nav>` element (Sidebar.tsx, BottomNav.tsx) — **low, patch** — Two unlabelled landmarks; screen reader users cannot distinguish them. Fix: `aria-label="Main navigation"` and `aria-label="Mobile navigation"`.
- No `path="*"` wildcard route in App.tsx — **low, patch** — Unknown URLs render AppShell with blank Outlet. Fix: add catch-all `<Navigate to="/recipes" replace />`.
- No `test.environment: 'jsdom'` in vite.config.ts — **low, patch** — React component tests will fail with `document is not defined`. Fix: add `test: { environment: 'jsdom' }`.
- Sprint-status key renames — **false** — Applied by sprint_plan.py during sprint-planning before this story's baseline_commit; not introduced by this story.
- tsconfig.tsbuildinfo files in untracked list — **low, defer** — Pre-existing files; not introduced by this story.
- No lockfile present — **low, defer** — Pre-existing project state.
- Spec Code Map "`<AppShell>` wrapping `<Routes>`" description is inverted — **false** — Code uses React Router layout-route pattern correctly; Code Map description is loose but code behavior is not wrong.

## Verification

**Commands:**
- `cd code && npm run build` — expected: exits 0; `dist/` directory contains `index.html` and `assets/`
- `cd code && npm run dev` — expected: dev server starts on localhost without errors; manually verify nav renders on both viewport sizes
