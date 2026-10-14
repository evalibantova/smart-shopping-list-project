import { describe, it, expect } from 'vitest'
import { fold, tokens, tokensMatch, shortlist, matchIngredient } from '../services/recipeImport/ingredientMatch'
import type { IngredientDbEntry } from '../types/ingredients'

function e(id: string, name: string, unit = 'g'): IngredientDbEntry {
  return { id, name, default_unit: unit, category: 'X' }
}

const db: IngredientDbEntry[] = [
  e('olive', 'olej olivový', 'ml'),
  e('soy', 'omáčka sójová', 'ml'),
  e('noodle', 'nudle ryžové'),
  e('spring', 'cibuľa jarná', 'pcs'),
  e('onion', 'cibuľa', 'pcs'),
  e('carrot', 'mrkva', 'pcs'),
  e('garlic', 'cesnak', 'cloves'),
  e('cab', 'kapusta'),
  e('sour', 'kapusta kyslá'),
  e('chili', 'omáčka čili', 'ml'),
  e('salt', 'soľ'),
]

describe('fold / tokens', () => {
  it('folds accents, case and spaces', () => {
    expect(fold('  Cibuľa   JARNÁ ')).toBe('cibula jarna')
  })
  it('splits on non letters/digits', () => {
    expect(tokens('morskú/himalájsku soľ')).toEqual(['morsku', 'himalajsku', 'sol'])
    expect(tokens('Olej, olivový (extra)')).toEqual(['olej', 'olivovy', 'extra'])
    expect(tokens('')).toEqual([])
  })
})

describe('tokensMatch', () => {
  it('matches equal and short-ending variants', () => {
    expect(tokensMatch('cibulka', 'cibula')).toBe(true)
    expect(tokensMatch('carrot', 'carrots')).toBe(true)
    expect(tokensMatch('tomato', 'tomatoes')).toBe(true)
    expect(tokensMatch('mrkva', 'mrkvu')).toBe(true)
    expect(tokensMatch('cesnak', 'cesnaku')).toBe(true)
    expect(tokensMatch('sol', 'sol')).toBe(true)
  })
  it('matches short plurals with s or es', () => {
    expect(tokensMatch('egg', 'eggs')).toBe(true)
    expect(tokensMatch('pea', 'peas')).toBe(true)
    expect(tokensMatch('oat', 'oats')).toBe(true)
    expect(tokensMatch('potato', 'potatoes')).toBe(true)
    expect(tokensMatch('ab', 'abs')).toBe(false)
  })
  it('rejects different words', () => {
    expect(tokensMatch('kapusta', 'kapustnica')).toBe(false)
    expect(tokensMatch('ryza', 'ryze')).toBe(false)
    expect(tokensMatch('olej', 'omacka')).toBe(false)
  })
})

describe('matchIngredient', () => {
  it('matches inverted word order', () => {
    expect(matchIngredient('olivový olej', db)?.id).toBe('olive')
    expect(matchIngredient('sójová omáčka', db)?.id).toBe('soy')
    expect(matchIngredient('jarná cibuľka', db)?.id).toBe('spring')
    expect(matchIngredient('ryžové nudle', db)?.id).toBe('noodle')
  })
  it('matches endings', () => {
    expect(matchIngredient('cibuľka', db)?.id).toBe('onion')
    expect(matchIngredient('mrkvu', db)?.id).toBe('carrot')
  })
  it('matches plurals', () => {
    const d = [e('c', 'Carrot'), e('t', 'Tomato')]
    expect(matchIngredient('carrots', d)?.id).toBe('c')
    expect(matchIngredient('tomatoes', d)?.id).toBe('t')
  })
  it('binds short plurals', () => {
    const d = [e('egg', 'Egg', 'pcs'), e('pea', 'Pea')]
    expect(matchIngredient('eggs', d)?.id).toBe('egg')
    expect(matchIngredient('peas', d)?.id).toBe('pea')
  })
  it('gives no false positives', () => {
    expect(matchIngredient('čínska kapusta', db)).toBeUndefined()
    expect(matchIngredient('kapusta', [e('n', 'kapustnica')])).toBeUndefined()
    expect(matchIngredient('ryžové rezance', db)).toBeUndefined()
  })
  it('prefers exact folded equality over a fuzzy match', () => {
    const d = [e('fuzzy', 'carrots'), e('exact', 'Carrot')]
    expect(matchIngredient('carrot', d)?.id).toBe('exact')
  })
  it('handles empty input', () => {
    expect(matchIngredient('', db)).toBeUndefined()
    expect(matchIngredient('mrkva', [])).toBeUndefined()
  })
})

describe('shortlist', () => {
  it('returns partial candidates with their score', () => {
    const r = shortlist('čínska kapusta', db)
    expect(r.map((c) => [c.entry.id, c.score])).toEqual([
      ['cab', 0.5],
      ['sour', 0.5],
    ])
  })
  it('orders by score, then fewer tokens, then db order', () => {
    const d = [e('a', 'cibuľa jarná'), e('b', 'cibuľa'), e('c', 'cibuľa')]
    expect(shortlist('cibuľa', d).map((c) => c.entry.id)).toEqual(['b', 'c', 'a'])
    expect(shortlist('jarná cibuľa', d)[0].entry.id).toBe('a')
  })
  it('limits to k (default 5)', () => {
    const many = Array.from({ length: 8 }, (_, i) => e(`i${i}`, `kapusta ${i}x`))
    expect(shortlist('kapusta', many)).toHaveLength(5)
    expect(shortlist('kapusta', many, 2)).toHaveLength(2)
  })
  it('is empty for empty db or query', () => {
    expect(shortlist('mrkva', [])).toEqual([])
    expect(shortlist('', db)).toEqual([])
  })
})
