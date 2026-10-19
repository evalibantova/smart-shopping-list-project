import { describe, it, expect } from 'vitest'
import { searchIngredients } from '../utils/ingredientSearch'
import type { IngredientDbEntry } from '../types/ingredients'

const entry = (id: string, name: string): IngredientDbEntry => ({ id, name, default_unit: 'g', category: 'Other' })
const LIST = [entry('1', 'Cibuľa'), entry('2', 'Chicken breast'), entry('3', 'Chickpeas')]

describe('searchIngredients', () => {
  it('returns nothing for fewer than two characters', () => {
    expect(searchIngredients(LIST, '')).toEqual([])
    expect(searchIngredients(LIST, 'c')).toEqual([])
    expect(searchIngredients(LIST, ' c ')).toEqual([])
  })

  it('matches ignoring case and accents, in list order', () => {
    expect(searchIngredients(LIST, 'CHICK').map((e) => e.id)).toEqual(['2', '3'])
    expect(searchIngredients(LIST, 'cibul').map((e) => e.id)).toEqual(['1'])
  })

  it('returns an empty list when nothing matches', () => {
    expect(searchIngredients(LIST, 'tahini')).toEqual([])
  })
})
