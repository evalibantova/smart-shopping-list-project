import { create, StateCreator } from 'zustand'
import { recipesSlice, RecipesSlice } from './recipesSlice'
import { mealPlannerSlice, MealPlannerSlice } from './mealPlannerSlice'
import { pantrySlice, PantrySlice } from './pantrySlice'

export type CombinedStore = RecipesSlice & MealPlannerSlice & PantrySlice

export const useStore = create<CombinedStore>()((...a) => ({
  ...(recipesSlice as unknown as StateCreator<CombinedStore>)(...a),
  ...(mealPlannerSlice as unknown as StateCreator<CombinedStore>)(...a),
  ...(pantrySlice as unknown as StateCreator<CombinedStore>)(...a),
}))
