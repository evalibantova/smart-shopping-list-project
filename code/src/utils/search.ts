/**
 * Normalizes text for search by stripping diacritics/accents, lowercasing,
 * and normalizing common ligatures/digraphs.
 * Ensures bidirectional matching between accented and unaccented terms.
 * (e.g. "jókaiho" matches both "jó" and "jo"; "jo" matches "jókaiho")
 */
export function normalizeSearchText(text: string): string {
  if (!text) return ''
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/ł/g, 'l')
    .replace(/đ/g, 'd')
}

/**
 * Checks whether a target string contains the query string,
 * ignoring accents/diacritics and casing in both directions.
 */
export function searchMatches(target: string, query: string): boolean {
  const normQuery = normalizeSearchText(query.trim())
  if (!normQuery) return true
  const normTarget = normalizeSearchText(target)
  return normTarget.includes(normQuery)
}
