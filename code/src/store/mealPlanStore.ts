import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type MealType = 'breakfast' | 'lunch' | 'dinner'
export type MealSlotKey = string // `${YYYY-MM-DD}-${MealType}`

export interface PlannedMeal {
  id: string
  recipeId: string
  servings: number
  cooked: boolean
  recipeName: string
  recipeEmoji: string
}

interface MealPlanState {
  slots: Record<MealSlotKey, PlannedMeal[]>
  addMeal(date: string, meal: MealType, recipeId: string, servings: number, recipeName: string, recipeEmoji: string): void
  removeMeal(date: string, meal: MealType, id: string): void
  toggleCooked(date: string, meal: MealType, id: string): void
}

function slotKey(date: string, meal: MealType): MealSlotKey {
  return `${date}-${meal}`
}

export const useMealPlanStore = create<MealPlanState>()(
  persist(
    (set) => ({
      slots: {},

      addMeal(date, meal, recipeId, servings, recipeName, recipeEmoji) {
        const key = slotKey(date, meal)
        const id = `pm_${Date.now()}_${Math.random().toString(36).slice(2)}`
        set(s => ({
          slots: {
            ...s.slots,
            [key]: [...(s.slots[key] ?? []), { id, recipeId, servings, cooked: false, recipeName, recipeEmoji }],
          },
        }))
      },

      removeMeal(date, meal, id) {
        const key = slotKey(date, meal)
        set(s => ({
          slots: {
            ...s.slots,
            [key]: (s.slots[key] ?? []).filter(m => m.id !== id),
          },
        }))
      },

      toggleCooked(date, meal, id) {
        const key = slotKey(date, meal)
        set(s => ({
          slots: {
            ...s.slots,
            [key]: (s.slots[key] ?? []).map(m => m.id === id ? { ...m, cooked: !m.cooked } : m),
          },
        }))
      },
    }),
    { name: 'meal-plan-v1' }
  )
)
