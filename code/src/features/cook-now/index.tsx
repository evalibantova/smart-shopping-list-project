import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../../store'
import { RecipeDetail } from '../../components/shared/RecipeDetail'
import { FilterTabs } from '../../components/ui/FilterTabs'
import { Button } from '../../components/ui/Button'
import { computeAvailability } from './utils/cookNowUtils'

const FILTER_TABS = ['All', 'Ready', 'Almost'] as const
type Filter = 'All' | 'Ready' | 'Almost'

export default function CookNowPage() {
  const recipes = useStore((s) => s.recipes)
  const pantryItems = useStore((s) => s.pantryItems)
  const initPantry = useStore((s) => s.initPantry)

  const [filter, setFilter] = useState<Filter>('All')
  const [openRecipeId, setOpenRecipeId] = useState<string | null>(null)

  useEffect(() => {
    initPantry()
  }, [])

  // Build availability for every recipe, checking for at least 1 serving
  const cookableRecipes = recipes
    .map((recipe) => {
      const avail = computeAvailability(recipe, { servings: 1 }, pantryItems)
      return { recipe, avail }
    })
    .filter((m) => m.avail.tier !== 'far')
    .sort((a, b) => {
      // Ready before Almost, then by name
      if (a.avail.tier !== b.avail.tier) return a.avail.tier === 'ready' ? -1 : 1
      return a.recipe.name.localeCompare(b.recipe.name)
    })

  const filteredRecipes = cookableRecipes.filter((m) => {
    if (filter === 'All') return true
    if (filter === 'Ready') return m.avail.tier === 'ready'
    if (filter === 'Almost') return m.avail.tier === 'almost'
    return true
  })

  const openMeal = openRecipeId ? cookableRecipes.find((m) => m.recipe.id === openRecipeId) : null

  // Close on Escape
  useEffect(() => {
    if (!openRecipeId) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenRecipeId(null)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [openRecipeId])

  return (
    <div className="page">
      <div
        className="page-header"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <h1>Cook Now</h1>
        <FilterTabs
          tabs={FILTER_TABS}
          active={filter}
          onChange={(tab) => setFilter(tab as Filter)}
        />
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {cookableRecipes.length === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              padding: '48px 16px',
              color: 'var(--text-dim)',
            }}
          >
            <span style={{ fontSize: 48 }}>🥘</span>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-mid)' }}>
              Nothing cookable right now
            </span>
            <span style={{ fontSize: 13, textAlign: 'center' }}>
              Add ingredients to your pantry to see what you can cook.
            </span>
          </div>
        )}

        {cookableRecipes.length > 0 && filteredRecipes.length === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              padding: '48px 16px',
              color: 'var(--text-dim)',
            }}
          >
            <span style={{ fontSize: 48 }}>{filter === 'Ready' ? '✅' : '⏳'}</span>
            <span style={{ fontSize: 15, fontWeight: 600 }}>
              {filter === 'Ready' ? 'No recipes ready right now' : 'No almost-ready recipes'}
            </span>
          </div>
        )}

        {filteredRecipes.map(({ recipe, avail }) => {
          const { tier, missingCount, maxServings } = avail
          return (
            <div
              key={recipe.id}
              data-testid={`cook-now-card-${recipe.id}`}
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                padding: '12px 14px',
                borderRadius: 'var(--radius)',
                boxShadow:
                  tier === 'ready'
                    ? '0 0 0 2px var(--coral)'
                    : '0 0 0 2px var(--amber)',
                background: 'var(--surface)',
              }}
            >
              {/* Emoji */}
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'var(--surface2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  flexShrink: 0,
                }}
              >
                {recipe.emoji || '🍽️'}
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--text)',
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {recipe.name}
                </div>
                <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {tier === 'ready' ? (
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--coral)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 8 }}>●</span> Ready · {maxServings} serving{maxServings !== 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber)' }}>
                      {missingCount} missing · up to {maxServings} serving{maxServings !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Action */}
              <Button
                intent={tier === 'ready' ? 'primary' : 'amber'}
                size="sm"
                onClick={() => setOpenRecipeId(recipe.id)}
              >
                {tier === 'ready' ? 'Cook it' : 'Cook anyway'}
              </Button>
            </div>
          )
        })}
      </div>

      {/* Recipe detail overlay */}
      {openMeal &&
        createPortal(
          <div
            data-testid="cook-now-overlay"
            onClick={(e) => { if (e.target === e.currentTarget) setOpenRecipeId(null) }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.4)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              padding: '16px',
            }}
          >
            <div
              style={{
                background: 'var(--surface)',
                boxShadow: 'var(--shadow-md)',
                width: '100%',
                maxWidth: 480,
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                borderRadius: 'var(--radius)',
              }}
            >
              <RecipeDetail
                recipeId={openMeal.recipe.id}
                context="cook-now"
                ingredientAvailability={openMeal.avail.ingredientAvailability}
              />
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
