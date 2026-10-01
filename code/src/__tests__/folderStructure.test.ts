// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const srcDir = resolve(__dirname, '../')

describe('AC8 — Feature-sliced folder structure exists under src/', () => {
  it.each([
    'features/recipes',
    'features/meal-planner',
    'features/shopping-list',
    'features/pantry',
    'features/cook-now',
    'components/ui',
    'components/shared',
    'store',
    'services',
  ])('src/%s directory exists', (dir) => {
    expect(existsSync(resolve(srcDir, dir))).toBe(true)
  })

  it('src/styles/tokens.css file exists', () => {
    expect(existsSync(resolve(srcDir, 'styles/tokens.css'))).toBe(true)
  })
})
