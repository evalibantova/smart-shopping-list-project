import { describe, it, expect } from 'vitest'
import { stockBarColor } from '../features/pantry/index'

describe('stockBarColor', () => {
  it('ratio > 0.5 returns green', () => {
    expect(stockBarColor(0.75)).toBe('var(--green)')
  })

  it('ratio 0.2–0.5 returns amber', () => {
    expect(stockBarColor(0.35)).toBe('var(--amber)')
  })

  it('ratio < 0.2 returns red', () => {
    expect(stockBarColor(0.10)).toBe('var(--red)')
  })
})
