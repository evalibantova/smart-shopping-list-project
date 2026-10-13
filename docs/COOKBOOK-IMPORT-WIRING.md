# Cookbook seed

`code/src/data/cookbookSeed.json` is the **source of truth** for the app's seed data. It is edited by hand; the XML-based generator that produced it has been removed (it remains in git history, before the commit "chore: drop cookbook generator").

## Shape

`{ ingredients, recipes }`

- `ingredients[]`: `{ name, default_unit, category }` — 163 entries, Slovak names, valid app units and categories.
- `recipes[]`: `{ name, category, servings, servingsEstimated, url, notes, mainTag, ingredients[] }` — 53 recipes.
  - `notes`: Markdown (numbered method steps, or the description when there are no steps, then a `Zdroj: [host](url)` link).
  - `mainTag`: main-ingredient tag name or `null` (none for desserts).
  - `ingredients[]`: `{ ingredient (name), quantity, unit, estimated }`. `quantity` is in the ingredient's `default_unit`; `ingredient` must match an entry in `ingredients[]` by name.

## How it loads

`main.tsx` calls `importCookbookIfNeeded()` (`src/data/cookbookImport.ts`) before rendering.

- Guarded by the `slist_cookbook_imported` flag. If it differs from `IMPORT_VERSION`, the import **wipes** ingredients, recipes, tags, pantry and meal plan from `localStorage`, then loads the seed. After editing the JSON, bump `IMPORT_VERSION` to make browsers pick up the change (this also discards user-created data).
- Recipes are linked to ingredients by name; an unknown name throws.
- Each recipe gets a tag named after its category and one for `mainTag`; colors come from `TAG_COLORS` in `cookbookImport.ts` (unknown tag names fall back to grey, so add a color when adding a tag). The emoji comes from the category, or from keywords in the name when the category has none, else 🍴.
- The pantry and meal plan start empty.
- Notes render through `components/shared/NotesMarkdown.tsx` (Markdown + GFM autolinks + sanitized inline HTML; links open in a new tab).

## Tests

`src/__tests__/cookbookImport.test.ts` checks that every recipe ingredient resolves, quantities use the ingredient's `default_unit`, the import is idempotent, and tags have distinct colors.

## Known data caveats

- Ingredient names are Slovak base forms; a few Czech/Hungarian/English originals were translated, some exotic herbs stay as in the source.
- Unit conversions (spoon weights, piece weights, pack sizes) are approximations, reviewed and accepted by the owner.
- `estimated` per ingredient and `servingsEstimated` per recipe are kept in the JSON but not shown in the UI.
- Not imported from the original cookbook XML: images, prep/cook times, authors, ratings, original servings text.

## CSV copy

`code/src/data/csv/` holds a clean, human-readable snapshot of the seed (`ingredients.csv`, `recipes.csv`, `recipe_ingredients.csv`, linked by ids) for browsing in a spreadsheet. It was exported once from `cookbookSeed.json`; the JSON stays the source of truth, so re-export the CSVs after editing it.
