# Import from URL: smarter matching, new ingredients, estimates and tags — design

Status: approved. Amended during planning (two calls instead of one: see "Why two calls"). Date: 2026-10-14.
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

**Why two calls (correction made while planning):** the shortlist for an ingredient line can only be built after the line is known, and on pages without structured data the lines only exist once Gemini has parsed the page. So the work is split in two requests:

**Call 1: parse (the existing call, extended).** Page text in, structured recipe out, as today, plus:
- each ingredient also returns `line`: the line exactly as written on the page (used for the "From page:" hint and for call 2);
- the existing tag names (about 18) go into the prompt, and the recipe returns `tags` (up to 3 names copied from that list) and `newTags` (up to 2 more short tags, only if none of the listed ones fit).

**Local pass.** `mapToRecipe` (Phase 1) matches ingredients with `matchIngredient`, converts units deterministically, and maps tag names to existing tag ids (ignoring case and accents; names that do not exist become "new tags").

**Call 2: resolve (new, small, only when needed).** It runs only for rows the local pass could not finish: rows with no match, and matched rows whose quantity could not be converted (an estimate is needed). Input: the recipe name and, per such row, the original `line`, a locked flag, and up to 5 candidates from `shortlist` labelled A, B, C... with their names and default units (candidate letters instead of ids keep the request small). If no row needs help, there is no second call. Output per row: `match` (a candidate letter or null), `newIngredient` (only when match is null: `{ name (nominative singular, recipe language), default_unit (g, ml, kg, l, pcs, cloves, tbsp, tsp), category (Produce, Fish & Seafood, Meat, Dairy, Pantry & Dry Goods, Other) }`), and `estimate` (only when the line's amount cannot be converted exactly: a number in the default unit of the matched or new ingredient). A locked row (already matched locally) keeps its match and can only receive an estimate.

**What the app does with the answer (`applyResolutions`, pure):**
1. A `match` letter is used only when it names one of the candidates sent for that row. The row then binds to that ingredient and converts the parsed quantity into its default unit.
2. A `newIngredient` is accepted only with a valid unit; an unknown category becomes "Other". If the local matcher can already bind the proposed name to an existing ingredient, the row binds instead of creating. Two rows proposing the same new ingredient create one.
3. Quantity precedence: deterministic conversion wins; otherwise the model's `estimate`; otherwise quantity 0, flagged. A row using an estimate carries `estimated: true` and stays flagged.
4. If call 2 fails (network, rate limit, bad reply, timeout) the import does not fail: the local draft stands as it is. Only a user abort stops the import.

**Draft shape (extends `RecipeDraft` / `DraftRow`, all new fields optional so existing code keeps compiling):** `DraftRow` gains `matchedBy?: 'local' | 'ai'`, `estimated?: boolean`, and `newIngredient?: { name, default_unit, category } | null`. `ParsedIngredient` gains `line?: string`; `ParsedRecipe` gains `tags?: string[]` and `newTags?: string[]`. `RecipeDraft` gains `tagIds?: string[]` and `newTags?: string[]`.

**Review form (import mode of `AddEditRecipeModal`):**
- AI-picked match: a hint line "Matched by AI: {page name} → {ingredient}" in the existing `rf-ing-hint` style. Changing the ingredient (retype or autocomplete) works as today.
- New ingredient: the row reads "New · {name} · {unit}" (unit read-only like every row). The banner counts them ("2 new ingredients will be created"). Editing the name or choosing another ingredient cancels the creation for that row.
- Estimated quantity: amber quantity field with the hint "≈ estimated"; editing it clears the flag (existing behavior for flagged rows).
- Tags: proposed existing tags are preselected; new tags appear as chips marked "new"; the user can deselect any of them.
- The "Save without N unmatched ingredient(s)?" prompt stays as built. New ingredients do not trigger it (they are visible in the form and nothing is lost).

**Saving:** nothing is created before Save (Discard and closing create nothing, including new ingredients and tags). Save creates the new ingredients with `ingredientsDbService.create(name, default_unit, category)`, creates the selected new tags with `tagService.create(name, color)` (neutral grey `#9E9E9E`), then creates the recipe bound to the resulting ids.

**Cost and latency:** call 1 grows by the tag names (about 100 input tokens) and the `line` field (about 10 output tokens per ingredient). Call 2 sends only unresolved rows, roughly 50 input and 40 output tokens per row, so a typical import adds well under a tenth of a cent, and nothing at all when the local pass resolves every row. A second request adds about one to three seconds when it runs, and a progress label "Matching ingredients…" shows while it does.

## Error handling and edge cases

- Call 1 keeps its existing behavior: a reply that is not valid JSON of the expected shape is retried once, then reported as "couldn't find a recipe". Call 2 never blocks the import: a malformed reply is retried once and then ignored, and any error leaves the local draft in place.
- Candidate letters the app never sent, units outside the allowed list, unknown categories, and negative or non-numeric estimates are ignored or corrected as described above.
- The existing guards stay: nothing is saved before Save; the key is only in the request header.
- The response schema grows (nested nullable objects); it may be rejected by the API or truncated by `maxOutputTokens`. Both are checked by a live import (see Risks).

## Testing

- Unit: call 1 request (tag names and the `line` field), call 2 request (candidate letters, no ids, only unresolved rows) and its validation (bad letters, units, categories, estimates, locked rows), mapping precedence (valid pick, fallback, deterministic conversion over estimate, estimate only when needed, de-duplication of new ingredients and tags), and the orchestrator (no second call when nothing is unresolved; a failing second call leaves the local draft; abort propagates).
- Component: Save creates the new ingredients and tags; Discard and closing create none; a deselected new tag is not created; editing clears the estimated flag; choosing another ingredient cancels a new-ingredient creation; banner counts.
- Not testable offline: the model's real choices. Verified by importing real pages after deploy (the fitshaker page above is the acceptance case).

## Risks

- The model may pick a wrong candidate or invent a poor estimate. Mitigation: AI-picked and estimated rows are marked, and the review step is mandatory.
- The nested response schema (call 2 has a nullable nested object) or the larger replies may fail on the live API (possibly thinking-token truncation on the 3.5 model). Mitigation: live import first; fallback is a flatter schema and a higher `maxOutputTokens`. Because call 2 failing never fails the import, the worst case is Phase 1 behavior.
- A second request adds latency and uses a second request of the rate limit. Mitigation: it only runs when needed.
- Proposed new ingredients can pollute the ingredient list with near-duplicates. Mitigation: the local matcher runs before creation, and the user sees and can cancel every creation.

## Out of scope

Editing existing ingredients' default units, merging duplicate ingredients, remembering the user's corrections for next time, image import, and the chat assistant (see FUTURE-FEATURES.md).
