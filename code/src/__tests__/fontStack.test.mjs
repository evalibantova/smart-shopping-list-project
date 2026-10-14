import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

// A .mjs file on purpose: it reads the stylesheet with Node's fs, and the app's tsconfig has no Node types.
//
// Safari/iOS cannot render the Noto Color Emoji web font, so any emoji it covers comes out blank
// when it sits before the system fonts (seen on a real iPhone SE: only the plate rendered).
// Native emoji fonts must come first; Noto stays last as the fallback for Linux and headless browsers.
describe('root font stack', () => {
  // vitest runs from the code/ directory
  const css = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8')
  const stack = /font-family:\s*([^;]*Plus Jakarta Sans[^;]*);/.exec(css)?.[1] ?? ''
  const at = (name) => stack.indexOf(name)

  it('finds the root font-family declaration', () => {
    expect(stack).not.toBe('')
  })

  it('puts the text font first', () => {
    expect(at("'Plus Jakarta Sans'")).toBe(0)
  })

  it('lists the native emoji fonts before the Noto Color Emoji web font', () => {
    expect(at("'Noto Color Emoji'")).toBeGreaterThan(-1)
    for (const native of ["'Apple Color Emoji'", "'Segoe UI Emoji'", 'system-ui']) {
      expect(at(native), `${native} must be in the stack`).toBeGreaterThan(-1)
      expect(at(native), `${native} must come before Noto Color Emoji`).toBeLessThan(at("'Noto Color Emoji'"))
    }
  })
})
