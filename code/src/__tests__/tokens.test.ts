// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const srcDir = resolve(__dirname, '../')
const tokensPath = resolve(srcDir, 'styles/tokens.css')

const fileExists = existsSync(tokensPath)
const content = fileExists ? readFileSync(tokensPath, 'utf-8') : ''

function collectComponentFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const fullPath = resolve(dir, entry.name)
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== '__tests__') {
      return collectComponentFiles(fullPath)
    }
    const ext = extname(entry.name)
    if (ext === '.tsx' || ext === '.ts') return [fullPath]
    return []
  })
}

describe('AC6 — src/styles/tokens.css contains all design tokens', () => {
  it('tokens.css file exists at src/styles/tokens.css', () => {
    expect(fileExists).toBe(true)
  })

  describe('Color tokens (19 required)', () => {
    it.each([
      '--bg',
      '--surface',
      '--surface2',
      '--surface3',
      '--charcoal',
      '--charcoal2',
      '--coral',
      '--coral-dark',
      '--coral-pale',
      '--coral-border',
      '--amber',
      '--amber-pale',
      '--red',
      '--red-pale',
      '--border',
      '--border-mid',
      '--text',
      '--text-mid',
      '--text-dim',
    ])('defines CSS custom property %s', (token) => {
      expect(content).toContain(token)
    })
  })

  describe('Shadow tokens (3 required)', () => {
    it('defines --shadow-sm', () => {
      expect(content).toContain('--shadow-sm')
    })

    it('defines base --shadow token (not just --shadow-sm or --shadow-md)', () => {
      expect(content).toMatch(/--shadow\s*:/)
    })

    it('defines --shadow-md', () => {
      expect(content).toContain('--shadow-md')
    })
  })

  describe('Typography baseline', () => {
    it('references Plus Jakarta Sans font family', () => {
      expect(content).toContain('Plus Jakarta Sans')
    })

    it('sets 14px as base font size', () => {
      expect(content).toContain('14px')
    })

    it('sets 1.5 as line-height', () => {
      expect(content).toContain('1.5')
    })
  })

  describe('AC6 — No hardcoded values in component files', () => {
    it('no .tsx component file contains a hardcoded hex color (#rrggbb)', () => {
      const componentDirs = ['components', 'features', 'hooks'].map(d =>
        resolve(srcDir, d)
      )
      const files = componentDirs.flatMap(collectComponentFiles)
      const hardcoded: string[] = []
      for (const file of files) {
        const src = readFileSync(file, 'utf-8')
        const matches = src.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []
        // Allow hex values that are not color codes (e.g. inside comments or strings used for IDs)
        // Detect only standalone hex color patterns in style/className contexts
        const colorHex = matches.filter(m => /^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/.test(m))
        if (colorHex.length > 0) {
          hardcoded.push(`${file}: ${colorHex.join(', ')}`)
        }
      }
      expect(hardcoded).toEqual([])
    })

    it('no .tsx component file contains a hardcoded pixel dimension for colors or layout', () => {
      const componentDirs = ['components', 'features'].map(d => resolve(srcDir, d))
      const files = componentDirs.flatMap(collectComponentFiles)
      const violations: string[] = []
      // Detect inline style={{ color: 'red' }} or style={{ backgroundColor: '#...' }}
      const inlineColorPattern = /style=\{[^}]*(?:color|background)[^}]*#[0-9a-fA-F]/
      for (const file of files) {
        const src = readFileSync(file, 'utf-8')
        if (inlineColorPattern.test(src)) {
          violations.push(file)
        }
      }
      expect(violations).toEqual([])
    })
  })
})
