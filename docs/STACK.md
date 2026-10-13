# Frontend Tech Stack

## Decision table

| Layer | Choice | Notes |
|---|---|---|
| Framework | React 19.x | Upgraded from the originally planned 18.3 during development. |
| Build | Vite | Set `base: '/'`, `build.outDir: 'dist'`. Lock in `.htaccess` SPA fallback before first deploy. |
| Styling | CSS custom properties + inline styles; Tailwind v4 + `cva` for `Button` | Design tokens (colors, shadows, radii) are plain CSS custom properties on `:root` in `tokens.css`, mapped from the DESIGN.md tables. Tailwind v4 is installed (Vite plugin, `@import "tailwindcss"`), but only `Button` uses it, with `class-variance-authority` for its intent/size variants. Everything else is inline `style` props plus a few shared global classes in `tokens.css` (`.field`, `.field-group`, `.qty-unit`, `.form-label`, `.field-search`, page-layout classes). Future theme switching: override the custom properties under `[data-theme]` — no component changes needed. |
| App state | Zustand | One flat store. Shopping list, Cook Now badges, and pantry stock are pure selector functions derived from `mealPlan + recipes + pantry` — matches the "data drives UI" constraint. Replaces the useState / useContext approach. |
| Server state | TanStack Query v5 | Introduce when the PHP REST API is wired. Not used in the localStorage MVP phase — Zustand covers that period entirely. |
| Routing | React Router v7 — `BrowserRouter` | History mode (clean URLs). `.htaccess` already handles the SPA fallback, so hash mode is unnecessary. |
| Icons | Lucide React | Canonised in DESIGN.md. Tree-shaken per import. Revisit only if Lighthouse flags bundle size. |
| Forms | Plain controlled components (`useState`) | No form library. Fields are controlled inputs; the recipe form keeps its ingredient rows in a `useState<IngredientRow[]>`, which keeps autocomplete → canonical ID resolution and unit-lock logic imperative and readable. All inputs share the ledger `.field` style (see DESIGN.md "Form inputs"). |

## Component structure

Shared building blocks are single files (no per-component folders). Pages compose them; they also use inline styles and the global classes from `tokens.css` for their own layout.

```
src/
├── styles/
│   └── tokens.css            # :root tokens + global classes (page layout, .field family, .form-label, recipe-form .rf-*)
├── components/
│   ├── ui/                   # generic primitives
│   │   ├── Button.tsx        # cva + Tailwind; intent="primary|coral|secondary|ghost|amber|danger", size="default|sm|xs"
│   │   ├── IconButton.tsx    # 44×44 px; variant="default|accent|coral|danger"
│   │   ├── NumberInput.tsx   # stepper (− value +) for small counts
│   │   ├── Modal.tsx         # backdrop + slideUp, bottom sheet on mobile; shared by every dialog (`flush` for full-bleed lists)
│   │   ├── Toast.tsx         # auto-dismisses after 3 s
│   │   ├── FilterTabs.tsx    # pill row, active = coral
│   │   ├── TagChip.tsx       # flat colored label, dot prefix; selectable variant = tinted background + check
│   │   └── SavingIndicator.tsx # fixed top-right spinner, shown while any mutation is in flight
│   └── shared/               # domain components used by several features
│       ├── IngredientAutocomplete.tsx
│       ├── RecipeDetail.tsx
│       ├── NotesMarkdown.tsx
│       └── AddToWeekModal.tsx
├── features/                 # one folder per page: recipes, meal-planner, pantry, cook-now, shopping-list
├── store/                    # Zustand slices (recipes, meal planner, pantry)
├── services/, types/, data/, utils/
```

Text, select, textarea and search fields are not components: use `className="field"` (search: wrap in `.field-search`). The pantry stock bar is drawn inline in the pantry page, coloured by `stockBarColor`.

## Key constraints driving these decisions

- **Static hosting** — FTP deploy, no Node.js runtime on server. Build outputs `dist/`.
- **No hash mode** — `.htaccess` rewrites all paths to `index.html`; clean URLs (`/meal-planner`) work out of the box.
- **Live-computed shopping list** — never stored, always derived from `mealPlan + recipes + pantry`. Zustand selectors make this a single pure function.
- **Optimistic UI** — all mutations update the Zustand store immediately; API errors surface via toast and roll back.
- **MVP uses localStorage** — TanStack Query is deferred until the PHP REST API is introduced.
- **Cross-platform build** — `npm scripts` only; no Unix-only shell syntax. Use `cross-env` if env vars are needed.
