# Wiring the cookbook import into the app

Status: **not wired.** `code/src/data/cookbookSeed.json` is generated and committed but nothing imports it.
The generator is `code/scripts/cookbook-import/` (`sh run.sh`, see its README). This note lists what is needed to load the data into the app.

## What the seed contains

`cookbookSeed.json` = `{ ingredients, recipes }`

- `ingredients[]`: `{ name, default_unit, category }` — same shape as `IngredientSeed` in `src/data/ingredientsSeed.ts`. 163 entries, Slovak names. Units are all valid app units; categories are the app's existing six.
- `recipes[]`: `{ name, category, servings, servingsEstimated, url, ingredients[] }`, 53 recipes.
  - `ingredients[]`: `{ ingredient (name), quantity, unit, estimated }`. `quantity` is already converted to the ingredient's `default_unit`, so it can go straight into `RecipeIngredient.quantity`.

## How the app loads data today

- Everything lives in `localStorage` (`slist_ingredients_db`, `slist_recipes`, pantry, tags, meal plan). IDs are `crypto.randomUUID()` generated at seed time, so recipes must be linked to ingredients by name at load time.
- `main.tsx` runs `ingredientsDbService.seedIfEmpty()`, `seedAppDataIfEmpty()` and `seedPantryIfEmpty()`. All three are no-ops when data already exists, so a returning browser will **not** pick up a new seed.
- `seedAppDataIfEmpty()` and `seedPantryIfEmpty()` look ingredients up by their **English** names (`'Olive oil'`, `'Garlic'`…). Replacing `INGREDIENTS_SEED` with the Slovak list would break both.

## What has to be done

1. **Decide: replace or merge with the demo seed.** The demo set (66 English ingredients, 5 demo recipes, demo pantry) overlaps the import (`Onion`/`cibuľa`, `Garlic`/`cesnak`…). Options: (a) keep demo data and add the import as extra ingredients (duplicates in autocomplete); (b) replace the demo seed with the import and rewrite `seedPantryIfEmpty()` to use Slovak names; (c) keep the demo for tests/dev and make the import a separate, explicit "load my cookbook" action. Language of the UI/ingredient names is tied to the "Language versions" backlog item.
2. **Add an import function** (e.g. `src/data/cookbookImport.ts`):
   - create each ingredient via `ingredientsDbService.create(name, default_unit, category)` unless a name already exists, and build `byName`;
   - create each recipe via `recipeService.create({...})` mapping `ingredient` → `ingredientId` through `byName`.
3. **Fill the `Recipe` fields the seed does not have:** `emoji` (required — pick a default, or map from `category`), `tagIds` (can be `[]`, or create tags from `category`: Polievka, Dezert, Hlavné jedlo…), `notes` (see 4).
4. **Decide what goes into `notes`.** The method text is deliberately not in the seed. It exists in `data/mycookbookrecipes.xml` (`<recipetext>`; two recipes have none). Either extend `seed.cjs` to export it, or leave `notes` empty and keep `url` somewhere (the `Recipe` type has no URL field).
5. **Decide how to show estimates.** `estimated` per ingredient and `servingsEstimated` per recipe have no home in `Recipe`/`RecipeIngredient`. Either drop them on import, or add optional fields and a UI hint.
6. **Make loading idempotent.** Because `seedIfEmpty` guards skip when data exists, use a versioned flag (e.g. `slist_cookbook_imported = 1`) or an explicit button; clearing `localStorage` is the only reset today.
7. **Pantry:** nothing is imported. Pantry items reference ingredient IDs, so `seedPantryIfEmpty()` needs the new ingredient names if the demo ingredients are replaced.
8. **Tests:** `ingredientsDbService.test.ts`, `recipeService.test.ts` and the shopping-list tests assume the demo ingredients/units. Add a test for the import (every recipe ingredient resolves to an ingredient; every quantity uses the ingredient's `default_unit`) and re-run `npm test` / `npm run lint` / `npm run build`.
9. **Keep it regenerable.** After any change to the rule tables or `data/proposals_*.csv`, run `sh code/scripts/cookbook-import/run.sh` and commit the regenerated `cookbookSeed.json`. Do not edit the JSON or CSVs by hand.

## Known data caveats

- Ingredient names are Slovak base forms; a few Czech/Hungarian/English originals were translated to Slovak, some exotic herbs (perilla, eryngium foetidum) stay as in the source.
- Unit conversions (spoon weights, piece weights, pack sizes) are approximations, reviewed and accepted by the owner.
- Recipes #9 (brownies) and #19 (grilled aubergine) have estimated ingredient lists because the source XML contained none.
- `servings` is a plain number; the original text is only in `recipes.csv` (`servings_text`).
