import { ingredientsDbService } from '../services/ingredientsDbService'
import { recipeService } from '../features/recipes/services/recipeService'
import { tagService } from '../features/recipes/services/tagService'
import seed from './cookbookSeed.json'

const IMPORT_FLAG = 'slist_cookbook_imported'
const IMPORT_VERSION = '8'
// Storage keys of the removed demo seed (and anything built on it); cleared when the import runs.
const RESET_KEYS = ['slist_ingredients_db', 'slist_recipes', 'slist_tags', 'slist_pantry', 'slist_meal_plan']

const CATEGORY_EMOJI: Record<string, string> = {
  Polievka: '🍲',
  Dezert: '🍰',
  'Hlavné jedlo': '🍽️',
  Príloha: '🥔',
  Snack: '🥨',
}
const DEFAULT_EMOJI = '🍴'
// Fallback for recipes whose category has no emoji: first keyword found in the name wins.
const NAME_EMOJI: [string, string][] = [
  ['medovník', '🍪'],
  ['guláš', '🥘'],
  ['rebierka', '🍖'],
  ['šalát', '🥗'],
  ['halušky', '🥟'],
  ['csalamádé', '🫑'],
]

function emojiFor(name: string, category: string): string {
  if (CATEGORY_EMOJI[category]) return CATEGORY_EMOJI[category]
  const lower = name.toLowerCase()
  return NAME_EMOJI.find(([kw]) => lower.includes(kw))?.[1] ?? DEFAULT_EMOJI
}
const DEFAULT_TAG_COLOR = '#9E9E9E'
const TAG_COLORS: Record<string, string> = {
  // categories
  Polievka: '#26A69A',
  Dezert: '#F06292',
  'Hlavné jedlo': '#5C6BC0',
  Príloha: '#D4E157',
  Snack: '#FFCA28',
  Iné: '#BDBDBD',
  // main ingredients
  bravčové: '#E57373',
  kuracie: '#FFB74D',
  hovädzie: '#B71C1C',
  zemiaky: '#C9A66B',
  kapusta: '#66BB6A',
  fazuľa: '#AD1457',
  šošovica: '#9CCC65',
  huby: '#8D6E63',
  ryža: '#90A4AE',
  paradajky: '#FF7043',
  baklažán: '#5E35B1',
  mušle: '#29B6F6',
}

export interface CookbookSeed {
  ingredients: { name: string; default_unit: string; category: string }[]
  recipes: {
    name: string
    category: string
    servings: number
    notes: string
    mainTag: string | null
    ingredients: { ingredient: string; quantity: number }[]
  }[]
}

export function importCookbook(data: CookbookSeed): void {
  const byName: Record<string, string> = {}
  for (const ing of ingredientsDbService.getAll()) byName[ing.name] = ing.id
  for (const ing of data.ingredients) {
    if (byName[ing.name]) continue
    byName[ing.name] = ingredientsDbService.create(ing.name, ing.default_unit, ing.category).id
  }

  const tagIdByName: Record<string, string> = {}
  for (const tag of tagService.getAll()) tagIdByName[tag.name] = tag.id

  const existingNames = new Set(recipeService.getAll().map((r) => r.name))
  for (const r of data.recipes) {
    if (existingNames.has(r.name)) continue
    const tagIds = [r.category, r.mainTag]
      .filter((name): name is string => !!name)
      .map((name) => {
        tagIdByName[name] ??= tagService.create(name, TAG_COLORS[name] ?? DEFAULT_TAG_COLOR).id
        return tagIdByName[name]
      })
    recipeService.create({
      emoji: emojiFor(r.name, r.category),
      name: r.name,
      servings: r.servings,
      tagIds,
      ingredients: r.ingredients.map((i) => {
        const ingredientId = byName[i.ingredient]
        if (!ingredientId) throw new Error(`Unknown ingredient in cookbook seed: ${i.ingredient}`)
        return { ingredientId, quantity: i.quantity }
      }),
      notes: r.notes,
    })
  }
}

// Replaces all stored data with the generated cookbook (Slovak ingredients + recipes).
// Runs once per browser, guarded by a versioned flag; bump IMPORT_VERSION to re-import.
export function importCookbookIfNeeded(): void {
  if (localStorage.getItem(IMPORT_FLAG) === IMPORT_VERSION) return
  for (const key of RESET_KEYS) localStorage.removeItem(key)
  importCookbook(seed as CookbookSeed)
  localStorage.setItem(IMPORT_FLAG, IMPORT_VERSION)
}
