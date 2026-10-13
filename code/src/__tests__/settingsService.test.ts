import { describe, it, expect, beforeEach } from 'vitest'
import { settingsService } from '../services/settingsService'

describe('settingsService — Gemini key', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns an empty string when no key is saved', () => {
    expect(settingsService.getGeminiKey()).toBe('')
    expect(settingsService.hasGeminiKey()).toBe(false)
  })

  it('saves the key trimmed and reads it back', () => {
    settingsService.setGeminiKey('  abc123  ')
    expect(settingsService.getGeminiKey()).toBe('abc123')
    expect(settingsService.hasGeminiKey()).toBe(true)
  })

  it('saving an empty or whitespace key removes it', () => {
    settingsService.setGeminiKey('abc123')
    settingsService.setGeminiKey('   ')
    expect(settingsService.getGeminiKey()).toBe('')
    expect(localStorage.getItem('slist_gemini_key')).toBeNull()
  })

  it('clearGeminiKey removes the stored key', () => {
    settingsService.setGeminiKey('abc123')
    settingsService.clearGeminiKey()
    expect(settingsService.hasGeminiKey()).toBe(false)
  })
})
