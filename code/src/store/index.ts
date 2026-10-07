import { create, StateCreator } from 'zustand'
import { recipesSlice, RecipesSlice } from './recipesSlice'
import { mealPlannerSlice, MealPlannerSlice } from './mealPlannerSlice'

export type CombinedStore = RecipesSlice & MealPlannerSlice

export const useStore = create<CombinedStore>()((...a) => ({
  ...(recipesSlice as unknown as StateCreator<CombinedStore>)(...a),
  ...(mealPlannerSlice as unknown as StateCreator<CombinedStore>)(...a),
}))
