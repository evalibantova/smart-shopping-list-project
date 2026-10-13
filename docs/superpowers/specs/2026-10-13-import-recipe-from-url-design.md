# Import recipe from URL — design

Status: approved in brainstorming, awaiting spec review. Date: 2026-10-13.

## Goal

Paste a recipe page URL, get the recipe prefilled in the existing recipe form, review it, and save. Token cost must stay very low.

## Decisions

| Question | Decision |
|---|---|
| How is the page fetched (browser CORS)? | A small standalone PHP endpoint fetches and trims the page. It is the first server code in the project. |
| How are ingredient lines parsed? | An LLM (Gemini) extracts structured data. Name matching and unit conversion into `default_unit` happen locally in the app. |
| Whose API key? | The user's own Gemini key, stored in `localStorage`. The server never sees it. |
| Who calls Gemini? | The browser, directly (approach A). The server only fetches and trims. |
| Saving? | Never automatic. The prefilled form is a review step and nothing is written until the user presses Save. |

## Components

1. **`api/fetch-recipe.php`** (new, standalone, stateless, no key). Input: `?url=`. Output: `{ source: "jsonld" | "text", text }`.
   - `jsonld`: the schema.org/Recipe JSON-LD block when the page has one (bare object, `@graph`, or `@type` array).
   - `text`: fallback. The page stripped of scripts, nav and styles, capped at about 6k characters.
2. **`code/src/services/recipeImport/`** (new):
   - `fetchPage.ts` calls the endpoint.
   - `geminiParse.ts` calls Gemini directly. The key goes in the `x-goog-api-key` header, never in a URL. The model is a Flash-Lite-tier model set in one constant (confirm the current name when planning). It uses a JSON response schema and returns `{ name, servings, ingredients: [{ name, quantity, unit }], steps[] }`.
   - `mapToRecipe.ts` is pure. It matches names to `ingredients_db` and converts units into each ingredient's `default_unit` (g, ml, kg, l, pcs, cloves, tbsp, tsp). It leaves a row unbound, or its quantity blank and flagged, when the name does not match or the units cannot be converted.
3. **Key storage:** a `geminiKey` entry in `localStorage`, set from a field in the import dialog (masked, with a clear button and a tip to restrict the key by HTTP referrer and set a low quota in AI Studio).
4. **UI:** an **Import from URL** button beside Add recipe in `features/recipes/index.tsx`. It opens a small dialog (URL field, status line, abort). On success it opens `AddEditRecipeModal` prefilled.

## Flow

URL → `fetch-recipe.php` → Gemini → `mapToRecipe` → recipe form in review mode → user presses Save.

The notes are the steps as numbered Markdown plus a `Zdroj: [host](url)` link, as in the cookbook seed.

## Review mode (explicit confirmation)

- The form shows a banner: "Imported from {host}. Check everything, then save." The primary button is Save recipe and the other is Discard. Closing the modal also discards. Nothing is written to the store or `localStorage` before Save.
- The existing form silently drops ingredient rows that are not bound to an ingredient on save. In review mode the banner counts them ("3 ingredients need matching"), and pressing Save with unbound rows asks "Save without these 3 ingredients?" instead of dropping them.
- Rows with failed or approximate unit conversion are flagged.
- Normal add and edit are unchanged.

## Errors and edge cases

**Endpoint**
- Only `http` and `https`. The host is resolved and private, loopback and link-local IPs are rejected, again after each redirect (at most 3).
- 10-second timeout, 2 MB cap, HTML content types only.
- Returns `{ error }` with one of `bad_url`, `blocked_host`, `fetch_failed`, `too_large`, `no_content`.
- Covered by the alpha's basic auth. A per-IP rate limit can come later.

**Front end**
- No key set: the dialog shows the key field first and Import stays disabled.
- Page fetch failure: a plain reason, and the URL stays in the field.
- Gemini 429: "Gemini rate limit reached, try again in a minute." Gemini 400 or 403: "key rejected, check it."
- Empty or implausible Gemini result (no ingredients and no steps): "couldn't find a recipe on that page". No empty form is opened.
- Malformed Gemini output: one automatic retry, then the same message.
- Abort button, plus timeouts for both the page fetch and the Gemini call.

**Key handling:** header only, never in logs or error messages.

**Known risks:** the key in `localStorage` is readable by XSS, so the `NotesMarkdown` sanitizer matters (imported text flows into notes). The blast radius is the user's own restricted key. On Google's free tier, prompts may be used to improve their products. If a future CSP is added, `connect-src` must allow `generativelanguage.googleapis.com`.

## Token cost

- JSON-LD first, so typically a few hundred tokens go to the model.
- The `ingredients_db` is never sent. Matching and unit conversion run locally.
- JSON response schema keeps the reply short.
- Cheapest model tier, in one constant.

## Testing

**Automated**
- `mapToRecipe` (Vitest): case, diacritics and plural matching; kg→g, l→ml, tbsp and tsp; impossible conversions (cups of flour into g) flagged; unmatched names unbound; quantities like "1/2", "1½", "2-3" parsed or flagged, never guessed.
- `geminiParse` (mocked `fetch`): key in header, not URL; response schema sent; 429, 400 and 403 handling; malformed JSON retries once.
- Review mode (component test): nothing saved before Save; Discard and close save nothing; Save with unbound rows shows the confirmation.
- Endpoint (PHPUnit; adds a small `composer.json`, the repo's first PHP tests): JSON-LD extraction shapes; text fallback strips scripts and nav and respects the cap; SSRF cases (`127.0.0.1`, `10.x`, `169.254.x`, `localhost`, redirect to a private IP, non-http schemes).

**Manual, once, early**
- A real browser call to Gemini with a throwaway key, to confirm CORS works and measure real token use. If CORS fails, revisit having the server make the Gemini call.
- One run each on a JSON-LD site and a no-JSON-LD site, including a Slovak one.

## Out of scope

Recipe images, caching fetched pages, bulk import, a browser extension, a server-side key option, live tests against real sites in CI.
