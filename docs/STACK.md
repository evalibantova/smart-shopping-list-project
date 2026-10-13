# Frontend Tech Stack

## Decision table

| Layer | Choice | Notes |
|---|---|---|
| Framework | React 19.x | Upgraded from the originally planned 18.3 during development. |
| Build | Vite | Set `base: '/'`, `build.outDir: 'dist'`. Lock in `.htaccess` SPA fallback before first deploy. |
| Styling | Tailwind CSS v4 + `cva` | Design tokens defined once in `@theme` (maps directly from DESIGN.md color/shadow/type tables). Component variants (Button intents, sizes, etc.) via `class-variance-authority`. Future theme switching by overriding `@theme` tokens under `[data-theme]` — zero component-level changes needed. |
| App state | Zustand | One flat store. Shopping list, Cook Now badges, and pantry stock are pure selector functions derived from `mealPlan + recipes + pantry` — matches the "data drives UI" constraint. Replaces the useState / useContext approach. |
| Server state | TanStack Query v5 | Introduce when the PHP REST API is wired. Not used in the localStorage MVP phase — Zustand covers that period entirely. |
| Routing | React Router v7 — `BrowserRouter` | History mode (clean URLs). `.htaccess` already handles the SPA fallback, so hash mode is unnecessary. |
| Icons | Lucide React | Canonised in DESIGN.md. Tree-shaken per import. Revisit only if Lighthouse flags bundle size. |
| Forms | React Hook Form + controlled ingredient rows | RHF handles simple fields (name, servings, notes, tags). The ingredient `useFieldArray` is replaced by a plain `useState<IngredientRow[]>` — keeps autocomplete → canonical ID resolution and unit-lock logic imperative and readable. Rows merge into RHF on submit. |

## Component design system

All visual primitives live in `src/components/ui/`. Page components only import from there — they never write a style rule directly.

```
src/
├── styles/
│   └── tokens.css          # @theme block: all DESIGN.md tokens (colors, shadows, type scale)
└── components/
    └── ui/                 # design system layer
        ├── Button/         # variant="primary|coral|secondary|ghost|danger", size="sm|xs"
        ├── IconButton/     # 44×44 px, variant="default|accent|coral|danger"
        ├── NumberInput     # stepper (− value +) for small counts; text/select/textarea/search use the global `.field` classes in tokens.css (ledger style, see DESIGN.md)
        ├── Modal/          # backdrop + slideUp animation, bottom-sheet on mobile; shared by every dialog (`flush` prop for full-bleed lists)
        ├── Toast/          # charcoal + amber variants, auto-dismiss
        ├── FilterTabs/     # pill row, active=coral
        ├── TagChip/        # flat colored label, dot prefix; selectable variant = tinted background + check
        ├── SavingIndicator/# fixed top-right spinner, shown while any mutation is in flight
        └── StockBar/       # 52 px pantry quantity bar, coral/amber/red thresholds
```

Each component accepts typed props for variants. `cva` composes the Tailwind classes; consumers never touch class names.

## Key constraints driving these decisions

- **Static hosting** — FTP deploy, no Node.js runtime on server. Build outputs `dist/`.
- **No hash mode** — `.htaccess` rewrites all paths to `index.html`; clean URLs (`/meal-planner`) work out of the box.
- **Live-computed shopping list** — never stored, always derived from `mealPlan + recipes + pantry`. Zustand selectors make this a single pure function.
- **Optimistic UI** — all mutations update the Zustand store immediately; API errors surface via toast and roll back.
- **MVP uses localStorage** — TanStack Query is deferred until the PHP REST API is introduced.
- **Cross-platform build** — `npm scripts` only; no Unix-only shell syntax. Use `cross-env` if env vars are needed.
