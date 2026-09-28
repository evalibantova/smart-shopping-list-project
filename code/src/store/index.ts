import { create } from 'zustand'
import { createRecipesSlice, type RecipesSlice } from './recipesSlice'
import { createMealPlannerSlice, type MealPlannerSlice } from './mealPlannerSlice'
import { createIngredientsDbSlice, type IngredientsDbSlice } from './ingredientsDbSlice'
import { createTagsSlice, type TagsSlice } from './tagsSlice'
import { createPantrySlice, type PantrySlice } from './pantrySlice'
import { createUiSlice, type UiSlice } from './uiSlice'
import { shoppingListSelectors, type ShoppingListSlice } from './shoppingListSlice'

type AppStore = RecipesSlice & MealPlannerSlice & IngredientsDbSlice & TagsSlice & PantrySlice & UiSlice & ShoppingListSlice

export const useStore = create<AppStore>((set) => ({
  ...createRecipesSlice(set),
  ...createMealPlannerSlice(set),
  ...createIngredientsDbSlice(set),
  ...createTagsSlice(set),
  ...createPantrySlice(set),
  ...createUiSlice(set),
  ...shoppingListSelectors,
}))
