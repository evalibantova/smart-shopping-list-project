import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import MealPlannerPage from '../features/meal-planner'
import { RecipePickerModal } from '../features/meal-planner/RecipePickerModal'
import { MealPlanOverlay } from '../features/meal-planner/MealPlanOverlay'
import { AddToWeekModal } from '../components/shared/AddToWeekModal'
import { getDayDates, toDateStr } from '../features/meal-planner/utils/calendarUtils'
import { queryKeys } from '../api/queryKeys'
import { useToastStore } from '../store/toastStore'
import { errorResponse, gate, installApi } from '../test/fetchMock'
import { ENTRY_PANCAKES, FLOUR, MILK, PANCAKES, PANTRY_FLOUR, PANTRY_MILK, TAG_BREAKFAST } from '../test/fixtures'
import { renderWithClient, typeInto, waitFor, type Rendered } from '../test/renderWithClient'
import type { MealPlanEntry } from '../types/mealPlan'
import type { PantryItem } from '../types/pantry'

const SEED = {
  recipes: [PANCAKES],
  tags: [TAG_BREAKFAST],
  ingredients: [FLOUR, MILK],
  pantry: [PANTRY_FLOUR, { ...PANTRY_MILK, quantity: 700 }],
  mealPlan: [ENTRY_PANCAKES],
}
const WEEK_START = new Date(2026, 9, 19) // Monday 2026-10-19, local time

describe('meal planner writes', () => {
  let rendered: Rendered
  const onClose = vi.fn()

  beforeEach(() => {
    onClose.mockReset()
  })

  afterEach(() => {
    rendered.unmount()
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
    useToastStore.setState({ message: '' })
  })

  const entries = () => rendered.client.getQueryData<MealPlanEntry[]>(queryKeys.mealPlan) ?? []
  const pantry = () => rendered.client.getQueryData<PantryItem[]>(queryKeys.pantry) ?? []
  const byLabel = (aria: string) => document.body.querySelector(`button[aria-label="${aria}"]`) as HTMLButtonElement

  describe('RecipePickerModal', () => {
    function renderPicker() {
      rendered = renderWithClient(<RecipePickerModal date="2026-10-20" slot="dinner" onClose={onClose} />, {
        seed: { ...SEED, mealPlan: [] },
      })
    }
    const pickFirst = () => (document.body.querySelector('[data-testid="recipe-picker-item"]') as HTMLButtonElement).click()

    it('picking a recipe closes at once, shows the entry at once and POSTs it with its client id', async () => {
      const g = gate()
      const server = installApi({
        handler: async (call) => {
          if (call.method === 'POST') await g.wait
          return undefined
        },
      })
      renderPicker()
      await act(async () => pickFirst())
      expect(onClose).toHaveBeenCalledTimes(1)
      await waitFor(() => expect(entries()).toHaveLength(1))
      const entry = entries()[0]
      expect(entry).toMatchObject({ date: '2026-10-20', slot: 'dinner', recipeId: 'rec-pancakes', servings: 2 })
      expect(entry.id).toMatch(/^[0-9a-f-]{36}$/)

      g.open()
      await waitFor(() => expect(server.find('POST', '/api/meal-plan')).toHaveLength(1))
      expect(server.find('POST', '/api/meal-plan')[0].body).toEqual(entry)
    })

    it('removes the entry again and toasts when the server refuses it', async () => {
      installApi({ handler: (call) => (call.method === 'POST' ? errorResponse(409, 'conflict') : undefined) })
      renderPicker()
      await act(async () => pickFirst())
      await waitFor(() => expect(useToastStore.getState().message).toBe('Could not save — please try again.'))
      expect(entries()).toEqual([])
    })
  })

  describe('AddToWeekModal', () => {
    it('POSTs the chosen day, slot and an integer number of servings', async () => {
      const server = installApi()
      const after = vi.fn()
      rendered = renderWithClient(
        <AddToWeekModal recipeId="rec-pancakes" defaultServings={2} weekStart={WEEK_START} onClose={onClose} onAfterConfirm={after} />,
        { seed: { ...SEED, mealPlan: [] } },
      )
      const radios = document.body.querySelectorAll<HTMLInputElement>('[data-testid="add-to-week-day-radio"]')
      act(() => radios[2].click())
      const select = document.body.querySelector('[data-testid="add-to-week-slot-select"]') as HTMLSelectElement
      act(() => {
        select.value = 'dinner'
        select.dispatchEvent(new Event('change', { bubbles: true }))
      })
      const servings = document.body.querySelector('[data-testid="add-to-week-servings"]') as HTMLInputElement
      act(() => typeInto(servings, '2.6'))
      await act(async () => (document.body.querySelector('[data-testid="add-to-week-confirm"]') as HTMLButtonElement).click())

      await waitFor(() => expect(server.find('POST', '/api/meal-plan')).toHaveLength(1))
      expect(server.find('POST', '/api/meal-plan')[0].body).toEqual({
        id: expect.any(String),
        date: toDateStr(getDayDates(WEEK_START)[2]),
        slot: 'dinner',
        recipeId: 'rec-pancakes',
        servings: 3,
      })
      expect(onClose).toHaveBeenCalledTimes(1)
      expect(after).toHaveBeenCalledTimes(1)
    })
  })

  describe('MealPlanOverlay', () => {
    function renderOverlay(seed = SEED) {
      rendered = renderWithClient(<MealPlanOverlay entryId="mp-1" weekStart={WEEK_START} onClose={onClose} />, { seed })
    }

    it('Mark as cooked flags the entry, deducts the scaled recipe from the pantry, entry first then batch', async () => {
      const server = installApi({ seed: SEED })
      renderOverlay()
      act(() => byLabel('Mark as cooked').click())
      await waitFor(() => expect(server.find('PUT', '/api/pantry/batch')).toHaveLength(1))
      // 4 servings of a 2-serving recipe: x2
      expect(server.calls.filter((c) => c.method === 'PUT').map((c) => c.path)).toEqual(['/api/meal-plan/mp-1', '/api/pantry/batch'])
      expect(server.find('PUT', '/api/meal-plan/mp-1')[0].body).toEqual({ cooked: true })
      expect(server.find('PUT', '/api/pantry/batch')[0].body).toEqual({
        deltas: [
          { ingredientId: 'ing-flour', delta: -400 },
          { ingredientId: 'ing-milk', delta: -600 },
        ],
      })
      expect(entries()[0].cooked).toBe(true)
      expect(pantry().map((p) => p.quantity)).toEqual([100, 100])
    })

    it('Unmark as cooked adds the ingredients back', async () => {
      const cooked = { ...SEED, mealPlan: [{ ...ENTRY_PANCAKES, cooked: true }] }
      const server = installApi({ seed: cooked })
      renderOverlay(cooked)
      act(() => byLabel('Unmark as cooked').click())
      await waitFor(() => expect(server.find('PUT', '/api/pantry/batch')).toHaveLength(1))
      expect(server.find('PUT', '/api/pantry/batch')[0].body).toEqual({
        deltas: [
          { ingredientId: 'ing-flour', delta: 400 },
          { ingredientId: 'ing-milk', delta: 600 },
        ],
      })
      expect(entries()[0].cooked).toBe(false)
    })

    it('a failing pantry batch rolls the entry and the pantry back and toasts', async () => {
      installApi({
        seed: SEED,
        handler: (call) => (call.path === '/api/pantry/batch' ? errorResponse(500, 'server_error') : undefined),
      })
      renderOverlay()
      act(() => byLabel('Mark as cooked').click())
      await waitFor(() => expect(useToastStore.getState().message).toBe('Could not save — please try again.'))
      // the rollback first shows the old entry; the refetch then carries cooked: false (the fake server saw the reversal PUT)
      await waitFor(() => expect(entries()).toEqual([{ ...ENTRY_PANCAKES, cooked: false }]))
      expect(pantry()).toEqual(SEED.pantry)
    })

    it('Remove from plan removes the entry at once, DELETEs it and closes', async () => {
      const server = installApi({ seed: SEED })
      renderOverlay()
      act(() => byLabel('Remove from plan').click())
      await waitFor(() => expect(server.find('DELETE', '/api/meal-plan/mp-1')).toHaveLength(1))
      expect(entries()).toEqual([])
      expect(onClose).toHaveBeenCalled()
    })
  })

  describe('MealPlannerPage', () => {
    const today = toDateStr(new Date())

    it('shows this week\'s planned recipes from the cache', () => {
      rendered = renderWithClient(<MealPlannerPage />, {
        seed: { ...SEED, mealPlan: [{ ...ENTRY_PANCAKES, date: today }] },
      })
      expect(document.body.querySelector('[data-testid="slot-item"]')?.textContent).toContain('Pancakes')
    })

    it('an entry whose recipe is gone can be removed (DELETE)', async () => {
      const server = installApi()
      rendered = renderWithClient(<MealPlannerPage />, {
        seed: { ...SEED, recipes: [], mealPlan: [{ ...ENTRY_PANCAKES, date: today }] },
      })
      const orphan = document.body.querySelector('[data-testid="slot-item-orphan"]')!
      expect(orphan.textContent).toContain('Recipe removed')
      await act(async () => (orphan.querySelector('button') as HTMLButtonElement).click())
      await waitFor(() => expect(server.find('DELETE', '/api/meal-plan/mp-1')).toHaveLength(1))
      expect(entries()).toEqual([])
    })
  })
})
