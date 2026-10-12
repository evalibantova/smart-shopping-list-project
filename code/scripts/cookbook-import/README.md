# cookbook-import

One-off pipeline that turns `mycookbookrecipes.xml` (repo root) into three CSVs:
`recipes.csv`, `ingredients.csv`, `recipe_ingredients.csv`. Run `sh run.sh`.

- `canon.cjs` — rules that merge inflected / foreign-language names into one base form (first match wins; `null` entries skip)
- `units.cjs` — unit normalisation and quantity parsing (ranges stored as the upper bound)
- `defaults.cjs` — `D` table: default unit and conversion factors per ingredient (estimates, only droždie = 7 g verified), plus quantity patches (`P`) for rows the parser missed
- `approve.cjs` — applies approved estimates from `proposals_missing_quantities.csv`, `proposals_servings.csv`, `proposals_empty_recipes.csv` and `proposals_empty_recipes_servings.csv` (flags them as `estimated`; `DROP` rows are removed)
- `export.cjs` — XML parsing and id assignment

Steps overwrite the CSVs, so edit the rule tables and rerun rather than editing the CSVs by hand.

Notes
- The conversion factors in `defaults.cjs` (spoon weights, average piece weights, pack sizes) were reviewed and accepted by the owner.
- Quantities and servings that were estimated, not taken from the cookbook, are flagged `estimated` / `servings_estimated` in the CSVs.
- `proposals_*.csv` are the approved estimates; `approve.cjs` stops if they no longer line up with the data.
- Recipe text (method) is intentionally not part of the export.
