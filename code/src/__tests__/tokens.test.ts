// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const srcDir = resolve(__dirname, '../')
const tokensPath = resolve(srcDir, 'styles/tokens.css')

const fileExists = existsSync(tokensPath)
const content = fileExists ? readFileSync(tokensPath, 'utf-8') : ''

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
})
