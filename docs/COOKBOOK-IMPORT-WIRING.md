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

The PHP seeder `code/public/api/db/seeds/CookbookSeeder.php` loads the seed into MySQL. It uses `code/public/api/src/CookbookData.php`, a port of the old TypeScript import logic. Run `npm run api:migrate`, then `npm run api:seed`; `npm run api:reset` rolls back, migrates and seeds again.

- The seeder only runs on an empty database: if `ingredients` already has a row it does nothing, so a second run never duplicates data. After editing the JSON, run `npm run api:reset` (this also discards user-created data).
- Recipes are linked to ingredients by name; an unknown name throws.
- Each recipe gets a tag named after its category and one for `mainTag`; colors come from `TAG_COLORS` in `CookbookData.php` (unknown tag names fall back to grey, so add a color when adding a tag). The emoji comes from the category, or from keywords in the name when the category has none, else 🍴.
- The pantry and meal plan start empty.
- Notes render through `components/shared/NotesMarkdown.tsx` (Markdown + GFM autolinks + sanitized inline HTML; links open in a new tab).

## Tests

`code/api-tests/CookbookDataTest.php` checks the conversion: the whole cookbook becomes 163 ingredients and 53 recipes, every ingredient/tag/recipe link resolves to a generated row, and emoji and tag colors follow the rules above. `code/api-tests/CookbookSeedTest.php` checks the seeder through the API: it loads the cookbook, seeding twice does not duplicate, and an already-populated database is left alone.

## Known data caveats

- Ingredient names are Slovak base forms; a few Czech/Hungarian/English originals were translated, some exotic herbs stay as in the source.
- Unit conversions (spoon weights, piece weights, pack sizes) are approximations, reviewed and accepted by the owner.
- `estimated` per ingredient and `servingsEstimated` per recipe are kept in the JSON but not shown in the UI.
- Not imported from the original cookbook XML: images, prep/cook times, authors, ratings, original servings text.

## CSV copy

`code/src/data/csv/` holds a clean, human-readable snapshot of the seed (`ingredients.csv`, `recipes.csv`, `recipe_ingredients.csv`, linked by ids) for browsing in a spreadsheet. It was exported once from `cookbookSeed.json`; the JSON stays the source of truth, so re-export the CSVs after editing it.
