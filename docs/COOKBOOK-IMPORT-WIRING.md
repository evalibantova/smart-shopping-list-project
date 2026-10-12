# Cookbook import — how it is wired

Status: **wired.** The cookbook is the app's only seed; the old English demo seed was removed.
The generator is `code/scripts/cookbook-import/` (`sh run.sh`, see its README); it writes `code/src/data/cookbookSeed.json`.

## What the seed contains

`cookbookSeed.json` = `{ ingredients, recipes }`

- `ingredients[]`: `{ name, default_unit, category }` — 163 entries, Slovak names, valid app units and categories.
- `recipes[]`: `{ name, category, servings, servingsEstimated, url, ingredients[] }` — 53 recipes with cleaned, shortened titles (title cleanup and overrides live in `seed.cjs`).
  - `ingredients[]`: `{ ingredient (name), quantity, unit, estimated }`. `quantity` is already in the ingredient's `default_unit`.

## How it loads

`main.tsx` calls `importCookbookIfNeeded()` (`src/data/cookbookImport.ts`) before rendering.

- Guarded by the `slist_cookbook_imported` flag. If it differs from `IMPORT_VERSION`, the import **wipes** ingredients, recipes, tags, pantry and meal plan from `localStorage`, then imports. Bump `IMPORT_VERSION` to force a reload of the seed in every browser (this also discards user-created data).
- Recipes are linked to ingredients by name. An unknown ingredient name throws.
- Each recipe gets a tag named after its category, an emoji from the category (or from keywords in the name when the category has none, else 🍴), and its source `url` as `notes`.
- The pantry and meal plan start empty.

## Not imported

- Method text (`<recipetext>` in `code/scripts/cookbook-import/data/mycookbookrecipes.xml`); `notes` holds only the URL.
- `estimated` per ingredient and `servingsEstimated` per recipe (no field in `Recipe`/`RecipeIngredient`).

## Keeping it regenerable

After any change to the rule tables or `data/proposals_*.csv`, run `sh code/scripts/cookbook-import/run.sh` and commit the regenerated `cookbookSeed.json`. Do not edit the JSON or CSVs by hand.

## Known data caveats

- Ingredient names are Slovak base forms; a few Czech/Hungarian/English originals were translated, some exotic herbs stay as in the source.
- Unit conversions (spoon weights, piece weights, pack sizes) are approximations, reviewed and accepted by the owner.
- Recipes "Čokoládové brownies" and "Grilovaný baklažán s mozzarelou a rajčinami" have estimated ingredient lists because the source XML contained none.
- `servings` is a plain number; the original text is only in `recipes.csv` (`servings_text`).
