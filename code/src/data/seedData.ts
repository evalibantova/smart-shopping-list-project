import { ingredientsDbService } from '../services/ingredientsDbService'
import { recipeService } from '../features/recipes/services/recipeService'
import { tagService } from '../features/recipes/services/tagService'
import { create as createMealPlan } from '../features/meal-planner/services/mealPlanService'

function getMondayOfCurrentWeek(): Date {
  const today = new Date()
  const day = today.getDay() // 0=Sun, 1=Mon...6=Sat
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(today)
  monday.setDate(today.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function dateStr(base: Date, daysOffset: number): string {
  const d = new Date(base)
  d.setDate(d.getDate() + daysOffset)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function seedAppDataIfEmpty(): void {
  if (recipeService.getAll().length > 0) return

  const allIngredients = ingredientsDbService.getAll()
  const byName: Record<string, string> = {}
  for (const ing of allIngredients) byName[ing.name] = ing.id

  // Tags
  const tagComfort = tagService.create('Comfort Food', '#FF7043')
  const tagVegetarian = tagService.create('Vegetarian', '#66BB6A')
  const tagQuick = tagService.create('Quick', '#42A5F5')
  const tagHealthy = tagService.create('Healthy', '#26A69A')

  // Recipes
  const spagBol = recipeService.create({
    emoji: '🍝',
    name: 'Spaghetti Bolognese',
    servings: 4,
    tagIds: [tagComfort.id],
    ingredients: [
      { ingredientId: byName['Ground beef'], quantity: 400 },
      { ingredientId: byName['Pasta'], quantity: 300 },
      { ingredientId: byName['Onion'], quantity: 1 },
      { ingredientId: byName['Garlic'], quantity: 3 },
      { ingredientId: byName['Canned tomatoes'], quantity: 400 },
      { ingredientId: byName['Tomato paste'], quantity: 2 },
      { ingredientId: byName['Olive oil'], quantity: 2 },
    ],
    notes:
      'Brown the meat in a hot pan. Soften onion and garlic in olive oil. Stir in tomato paste, then canned tomatoes. Add the browned meat and simmer 20 min. Season to taste.',
  })

  const greekSalad = recipeService.create({
    emoji: '🥗',
    name: 'Greek Salad',
    servings: 2,
    tagIds: [tagVegetarian.id, tagQuick.id],
    ingredients: [
      { ingredientId: byName['Tomato'], quantity: 2 },
      { ingredientId: byName['Cucumber'], quantity: 1 },
      { ingredientId: byName['Bell pepper'], quantity: 1 },
      { ingredientId: byName['Avocado'], quantity: 1 },
      { ingredientId: byName['Olive oil'], quantity: 2 },
    ],
    notes: 'Chop all vegetables into chunks. Drizzle generously with olive oil. Season with salt and pepper. Serve immediately.',
  })

  const garlicChicken = recipeService.create({
    emoji: '🍗',
    name: 'Garlic Butter Chicken',
    servings: 4,
    tagIds: [tagHealthy.id],
    ingredients: [
      { ingredientId: byName['Chicken breast'], quantity: 600 },
      { ingredientId: byName['Garlic'], quantity: 4 },
      { ingredientId: byName['Butter'], quantity: 40 },
      { ingredientId: byName['Lemon'], quantity: 1 },
    ],
    notes:
      'Pound chicken to even thickness. Season with salt and pepper. Melt butter in a pan over medium-high heat, add crushed garlic. Cook chicken 5–6 min per side until golden. Squeeze lemon juice over before serving.',
  })

  const chickpeaCurry = recipeService.create({
    emoji: '🍛',
    name: 'Chickpea Curry',
    servings: 3,
    tagIds: [tagVegetarian.id, tagHealthy.id],
    ingredients: [
      { ingredientId: byName['Chickpeas'], quantity: 400 },
      { ingredientId: byName['Coconut milk'], quantity: 400 },
      { ingredientId: byName['Onion'], quantity: 1 },
      { ingredientId: byName['Garlic'], quantity: 2 },
      { ingredientId: byName['Ginger'], quantity: 10 },
      { ingredientId: byName['Cumin'], quantity: 1 },
      { ingredientId: byName['Paprika'], quantity: 1 },
      { ingredientId: byName['Canned tomatoes'], quantity: 200 },
      { ingredientId: byName['Olive oil'], quantity: 1 },
    ],
    notes:
      'Fry cumin and paprika in oil for 1 min. Add diced onion, garlic, and grated ginger — cook until soft. Stir in chickpeas and canned tomatoes, then pour over coconut milk. Simmer 20 min until thickened.',
  })

  const scrambEggs = recipeService.create({
    emoji: '🥚',
    name: 'Scrambled Eggs',
    servings: 2,
    tagIds: [tagQuick.id],
    ingredients: [
      { ingredientId: byName['Eggs'], quantity: 4 },
      { ingredientId: byName['Butter'], quantity: 20 },
      { ingredientId: byName['Salt'], quantity: 0.5 },
      { ingredientId: byName['Black pepper'], quantity: 0.25 },
    ],
    notes: 'Beat eggs well with a pinch of salt. Melt butter over the lowest heat. Add eggs and stir slowly with a spatula until just set. Pull off the heat while still slightly runny — residual heat finishes them.',
  })

  // Meal plan for the current week (Mon–Sun)
  const monday = getMondayOfCurrentWeek()

  // Mon: Dinner - Spaghetti Bolognese (cooked — it's in the past)
  createMealPlan({ id: crypto.randomUUID(), date: dateStr(monday, 0), slot: 'dinner', recipeId: spagBol.id, servings: 4, cooked: true })

  // Tue: Breakfast - Scrambled Eggs (cooked), Dinner - Chickpea Curry (not cooked yet)
  createMealPlan({ id: crypto.randomUUID(), date: dateStr(monday, 1), slot: 'breakfast', recipeId: scrambEggs.id, servings: 2, cooked: true })
  createMealPlan({ id: crypto.randomUUID(), date: dateStr(monday, 1), slot: 'dinner', recipeId: chickpeaCurry.id, servings: 3, cooked: false })

  // Wed: Lunch - Garlic Butter Chicken (cooked)
  createMealPlan({ id: crypto.randomUUID(), date: dateStr(monday, 2), slot: 'lunch', recipeId: garlicChicken.id, servings: 4, cooked: true })

  // Thu (today): Lunch - Greek Salad, Dinner - Spaghetti Bolognese
  createMealPlan({ id: crypto.randomUUID(), date: dateStr(monday, 3), slot: 'lunch', recipeId: greekSalad.id, servings: 2 })
  createMealPlan({ id: crypto.randomUUID(), date: dateStr(monday, 3), slot: 'dinner', recipeId: spagBol.id, servings: 4 })

  // Fri: Dinner - Chickpea Curry
  createMealPlan({ id: crypto.randomUUID(), date: dateStr(monday, 4), slot: 'dinner', recipeId: chickpeaCurry.id, servings: 3 })

  // Sat: Lunch - Greek Salad, Dinner - Garlic Butter Chicken
  createMealPlan({ id: crypto.randomUUID(), date: dateStr(monday, 5), slot: 'lunch', recipeId: greekSalad.id, servings: 2 })
  createMealPlan({ id: crypto.randomUUID(), date: dateStr(monday, 5), slot: 'dinner', recipeId: garlicChicken.id, servings: 4 })

  // Sun: Breakfast - Scrambled Eggs
  createMealPlan({ id: crypto.randomUUID(), date: dateStr(monday, 6), slot: 'breakfast', recipeId: scrambEggs.id, servings: 2 })
}
