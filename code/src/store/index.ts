import { create } from 'zustand'
import { recipesSlice, RecipesSlice } from './recipesSlice'

export const useStore = create<RecipesSlice>()(recipesSlice)
