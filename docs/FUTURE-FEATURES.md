## Future Feature Backlog (captured during design)

- **Week templates:** save and reapply named week plans
- **Copy last week:** one-click duplicate of previous week's plan
- **Barcode scanner:** scan a product barcode (via device camera) to add or update pantry items — name, unit, and category auto-filled from Open Food Facts or a similar open product database. Primary input method for fast pantry entry; without it, maintaining a large pantry requires too much manual typing to be sustainable long-term.
- **Receipt scanner:** photograph a grocery receipt to auto-populate pantry stock
- **"Cook now" suggestions:** list recipes that can be made from current pantry contents
- **Expiry date tracking:** add best-before dates to pantry items
- **Full shopping list editor:** rename, reorder, regroup items before shopping
- **Nutritional data:** integrate kaloricketabluky.sk or similar API for per-ingredient macro/calorie data
- **Microsoft To Do integration:** push the generated shopping list to a Microsoft To Do list (via Microsoft Graph API) so it can be checked off on the phone while shopping; ideally sync checked state back to the app
- **Language versions (i18n):** translate the UI into multiple languages (e.g. English and Slovak) with a language switcher; externalize all UI strings from the start. Open question: how to handle user-entered content (recipe names, ingredients, units) and ingredient matching across languages

## AI Chatbot (v1 Feature)

A chat window inside the app where the user gives natural-language instructions to create and edit recipes, pantry items, meal plans and the shopping list ("add 500 g flour to the pantry", "plan the bean soup for Tuesday dinner", "make the goulash recipe serve 6"). An LLM in the background translates the request into action items, which are calls to predefined app functions. **The assistant proposes first and acts only after the user confirms.**

**Propose, then confirm:**

1. The user types an instruction in the chat window.
2. The LLM answers with a proposed change set: a list of the function calls it wants to make, with their arguments. Nothing is changed yet.
3. The app shows the proposal as a readable list of changes (for example "Add recipe: Pancakes, 4 servings, 5 ingredients", "Pantry: flour 800 g → 300 g", "Meal plan: Tue dinner = Bean soup"), so the user sees exactly what will happen.
4. The user confirms (all of it, or item by item) or rejects or edits the request. Only then does the app run the confirmed functions.
5. The chat reports what was done. Read-only questions ("what can I cook now?") need no confirmation.

**Architecture:** LLM function calling — the model calls predefined tools rather than returning freeform text the app must parse. This is the guardrail: the LLM can only trigger permitted operations, and write operations never run without the confirmation step above. The functions run in the browser against the same stores and services the UI uses, so chat changes behave exactly like manual ones.

**Permitted tools (write):**

- `update_pantry(ingredient, quantity, unit, operation: set|add|subtract)`
- `add_recipe(name, servings, ingredients[], notes)` and `update_recipe(recipe_id, changes)`
- `modify_shopping_list(action: add|remove|check, items[])`
- `plan_meal(day, slot, recipe_id)` and clearing or moving a planned meal

**Permitted tools (read):**

- `get_pantry()` — what's in stock
- `get_cookable_recipes()` — what can I make now
- `get_shopping_list()` — current list
- `get_recipes()` / `get_meal_plan()` — so the model can refer to existing items by name

**Provider:** Provider-agnostic — user supplies their own API key (Gemini, Claude, OpenAI, etc.). App sends requests to the selected provider's function-calling endpoint. Gemini is the first provider: the key already lives in Settings and the browser-side Gemini client exists from Import from URL.

**Ideas to reuse and open questions (captured, not designed yet):**

- Reuse the Import from URL building blocks: the Settings key, the Gemini client with its timeouts and error messages, the ingredient name matching and unit conversion (`mapToRecipe`), and the review pattern (amber rows for unmatched items, an explicit confirm before saving).
- Ingredient names must still bind to canonical `ingredients_db` entries; unmatched names need the same "match or create" handling as the recipe form.
- Ambiguous instructions: the model should ask a clarifying question instead of guessing.
- Destructive actions (delete a recipe, clear a week) should get a stronger confirmation, and an "undo last change set" is worth considering.
- Token cost: keep the conversation short and let the model fetch data through read tools instead of sending the whole database every time.
- Privacy: data stays in the browser; the model only sees what the read tools return and what the user types.

**Why deferred:** The data model needs to be stable before the chatbot can reliably operate on it. Build MVP CRUD first, then layer the assistant on top.
