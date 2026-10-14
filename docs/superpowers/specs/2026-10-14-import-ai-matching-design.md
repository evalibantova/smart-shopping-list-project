# Import from URL: smarter matching, new ingredients, estimates and tags — design

Status: design approved in brainstorming (sections 1 to 3), awaiting spec review. Date: 2026-10-14.
Builds on: `docs/superpowers/specs/2026-10-13-import-recipe-from-url-design.md` (the first version of Import from URL).

## Why

A real import of a Slovak recipe page (fitshaker.sk, no JSON-LD, so the text fallback was used) matched poorly against the ingredient database:

| Page line | What the user expects | What went wrong |
|---|---|---|
| 1 veľkú mrkvu | 1 pcs mrkva | quantity lost (size word taken for a unit) |
| 1 jarnú cibuľku | 1 pcs cibuľa jarná | unmatched (word order, ending), quantity lost |
| 4 strúčiky cesnaku | 4 cloves cesnak | worked |
| 1/3 čínskej kapusty | new ingredient "čínska kapusta", about 300 g | unmatched (not in the DB), quantity lost |
| 3 lyžice olivového oleja | olej olivový, 3 tbsp (stored in ml: 45 ml) | name order |
| 100 g ryžových rezancov | nudle ryžové, 100 g | synonym (rezance and nudle) |
| morskú/himalájsku soľ | soľ, a small default amount | no amount on the page |
| 12 ks väčších kreviet | 12 pcs krevety (new ingredient) | not in the DB |

Constraint from the first spec that still holds: the unit shown in the recipe form is read-only and comes from the ingredient's `default_unit`, so "3 lyžice" of an ingredient stored in ml appears as 45 ml.

No hardcoded synonym or ingredient lists anywhere: understanding comes from local rules (word sets) and from the model.

## Two phases

### Phase 1: local matching and prompt fix (DONE, commits 5669f2d, 63291d1, be4f337)
- New `code/src/services/recipeImport/ingredientMatch.ts`: names are compared as word sets, ignoring order and accents; words match when equal, when they differ by a short ending (cibuľka and cibuľa), or by a plural "s"/"es" on a word of 3+ letters. Only a full word-set match binds automatically; partial overlap never does ("čínska kapusta" stays unmatched against "kapusta"). `shortlist(name, db, k)` returns the scored top-k candidates for Phase 2.
- The prompt no longer tells the model to discard quantities after unfamiliar words; it explains size words, pcs, cloves, lyžica = tbsp, lyžička = tsp, decimal fractions, and null only when there is no amount or a range.

### Phase 2: model-assisted matching, new ingredients, estimates and tags (this spec's build)

**What Gemini receives:** the ingredient lines of the recipe, a shortlist of up to 5 candidates for each line (id, name, default unit; from `shortlist`, only candidates with a score above 0), and the names of the existing tags (about 18).

**What it returns:**
- Per ingredient line: the parsed `name`, `quantity` and `unit` as today, plus
  - `matchId`: one of the candidate ids for that line, or null;
  - `newIngredient`: only when `matchId` is null and no candidate fits: `{ name (nominative singular, recipe language), default_unit (g, ml, kg, l, pcs, cloves, tbsp, tsp), category (Produce, Fish & Seafood, Meat, Dairy, Pantry & Dry Goods, Other) }`;
  - `estimate`: only when a deterministic conversion is impossible (1/3 of a head to grams, "to taste"): `{ quantity }` expressed in the default unit of the chosen or proposed ingredient.
- For the recipe: `tags`: names chosen from the existing tag list, and `newTags`: a few additional tag names the model suggests (for example a main-ingredient tag).

**What the app does with it (mapping):**
1. A `matchId` is used only when it is one of the candidates sent for that line. Otherwise the app falls back to the local `matchIngredient`, then to an unmatched row.
2. A proposed `newIngredient` is accepted only with a valid unit; an unknown category becomes "Other". If the local matcher can already bind the proposed name to an existing ingredient, it binds instead of creating. Two lines proposing the same new ingredient create one.
3. Quantity precedence: deterministic conversion of the parsed quantity and unit into the ingredient's default unit (existing table: g/kg, ml/l, tsp/tbsp/cup, matching counts) wins; otherwise the model's `estimate`; otherwise quantity 0 flagged. A row using an estimate carries `estimated: true`.
4. Tags: existing tag names (matched ignoring case and accents) become preselected tag ids; unknown names become "new tags".

**Draft shape (extends `RecipeDraft` / `DraftRow`):** `DraftRow` gains `matchedBy: 'local' | 'ai'`, `estimated: boolean`, and `newIngredient: { name, default_unit, category } | null`. `RecipeDraft` gains `tagIds: string[]` and `newTags: string[]`.

**Review form (import mode of `AddEditRecipeModal`):**
- AI-picked match: a hint line "Matched by AI: {page name} → {ingredient}" in the existing `rf-ing-hint` style. Changing the ingredient (retype or autocomplete) works as today.
- New ingredient: the row reads "New · {name} · {unit}" (unit read-only like every row). The banner counts them ("2 new ingredients will be created"). Editing the name or choosing another ingredient cancels the creation for that row.
- Estimated quantity: amber quantity field with the hint "≈ estimated"; editing it clears the flag (existing behavior for flagged rows).
- Tags: proposed existing tags are preselected; new tags appear as chips marked "new"; the user can deselect any of them.
- The "Save without N unmatched ingredient(s)?" prompt stays as built. New ingredients do not trigger it (they are visible in the form and nothing is lost).

**Saving:** nothing is created before Save (Discard and closing create nothing, including new ingredients and tags). Save creates the new ingredients with `ingredientsDbService.create(name, default_unit, category)`, creates the selected new tags with `tagService.create(name, color)` (neutral grey `#9E9E9E`), then creates the recipe bound to the resulting ids.

**Cost:** about 500 to 800 extra input tokens and a few hundred extra output tokens per import, roughly a tenth of a cent at the current Flash-Lite prices. The shortlist keeps the ingredient list from being sent whole.

## Error handling and edge cases

- A model reply that fails validation falls back, row by row, to Phase 1 behavior; it never blocks the import. A reply that is not valid JSON of the expected shape is retried once, then reported as "couldn't find a recipe", as today.
- `matchId` values the app never sent, units outside the allowed list, and negative or non-numeric estimates are ignored.
- The existing guards stay: nothing is saved before Save; the key is only in the request header.
- The response schema grows (nested nullable objects); it may be rejected by the API or truncated by `maxOutputTokens`. Both are checked by a live import (see Risks).

## Testing

- Unit: request building (shortlists and tag names present, input kept small), response validation (bad ids, units, categories, estimates), mapping precedence (valid pick, fallback, deterministic conversion over estimate, estimate only when needed, de-duplication of new ingredients and tags).
- Component: Save creates the new ingredients and tags; Discard and closing create none; a deselected new tag is not created; editing clears the estimated flag; choosing another ingredient cancels a new-ingredient creation; banner counts.
- Not testable offline: the model's real choices. Verified by importing real pages after deploy (the fitshaker page above is the acceptance case).

## Risks

- The model may pick a wrong candidate or invent a poor estimate. Mitigation: AI-picked and estimated rows are marked, and the review step is mandatory.
- The nested response schema or the larger reply may fail on the live API (possibly thinking-token truncation on the 3.5 model). Mitigation: live check first; fallback is a flatter schema and a higher `maxOutputTokens`.
- Proposed new ingredients can pollute the ingredient list with near-duplicates. Mitigation: the local matcher runs before creation, and the user sees and can cancel every creation.

## Out of scope

Editing existing ingredients' default units, merging duplicate ingredients, remembering the user's corrections for next time, image import, and the chat assistant (see FUTURE-FEATURES.md).
