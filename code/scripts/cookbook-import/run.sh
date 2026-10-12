#!/bin/sh
# Rebuilds recipes.csv, ingredients.csv and recipe_ingredients.csv from mycookbookrecipes.xml
# in the repo root (override with COOKBOOK_ROOT). Run the steps in order.
set -e
cd "$(dirname "$0")"
node export.cjs    # parse XML, dedupe ingredients (canon.js), assign ids
node units.cjs     # normalise units to g/ml/tsp/tbsp/pcs/cloves, ranges -> upper bound
node defaults.cjs  # per-ingredient default_unit + conversions (edit the D table)
node approve.cjs   # apply approved estimates from proposals_*.csv
node categories.cjs  # app categories per ingredient
node seed.cjs        # code/src/data/cookbookSeed.json
