const GEMINI_KEY = 'slist_gemini_key'

function getGeminiKey(): string {
  return localStorage.getItem(GEMINI_KEY) ?? ''
}

export const settingsService = {
  getGeminiKey,

  setGeminiKey(key: string): void {
    const trimmed = key.trim()
    if (trimmed) localStorage.setItem(GEMINI_KEY, trimmed)
    else localStorage.removeItem(GEMINI_KEY)
  },

  clearGeminiKey(): void {
    localStorage.removeItem(GEMINI_KEY)
  },

  hasGeminiKey(): boolean {
    return getGeminiKey() !== ''
  },
}
