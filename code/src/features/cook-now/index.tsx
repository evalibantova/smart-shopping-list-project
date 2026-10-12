import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useStore } from '../../store'
import { RecipeDetail } from '../../components/shared/RecipeDetail'
import { AddToWeekModal } from '../../components/shared/AddToWeekModal'
import { AddEditRecipeModal } from '../recipes/AddEditRecipeModal'
import { IconButton } from '../../components/ui/IconButton'
import { TagChip } from '../../components/ui/TagChip'
import { computeAvailability } from './utils/cookNowUtils'
import { getWeekStart } from '../meal-planner/utils/calendarUtils'

const FILTER_TABS = ['All', 'Ready', 'Almost'] as const
type Filter = 'All' | 'Ready' | 'Almost'

export default function CookNowPage() {
  const recipes = useStore((s) => s.recipes)
  const tags = useStore((s) => s.tags)
  const pantryItems = useStore((s) => s.pantryItems)
  const batchUpdatePantry = useStore((s) => s.batchUpdatePantry)
  const initPantry = useStore((s) => s.initPantry)

  const [filter, setFilter] = useState<Filter>('All')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [addToWeekOpen, setAddToWeekOpen] = useState(false)

  useEffect(() => { initPantry() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const weekStart = getWeekStart(new Date())

  const recipesWithAvail = useMemo(() =>
    recipes.map((recipe) => ({
      recipe,
      avail: computeAvailability(recipe, { servings: recipe.servings }, pantryItems),
    })),
    [recipes, pantryItems]
  )

  const cookable = useMemo(() =>
    recipesWithAvail
      .filter((m) => m.avail.tier !== 'far')
      .sort((a, b) => {
        if (a.avail.tier !== b.avail.tier) return a.avail.tier === 'ready' ? -1 : 1
        return a.avail.missingCount - b.avail.missingCount || a.recipe.name.localeCompare(b.recipe.name)
      }),
    [recipesWithAvail]
  )

  const filtered = useMemo(() =>
    cookable.filter((m) => {
      if (filter === 'Ready') return m.avail.tier === 'ready'
      if (filter === 'Almost') return m.avail.tier === 'almost'
      return true
    }),
    [cookable, filter]
  )

  const selectedMeal = useMemo(() =>
    selectedId ? recipesWithAvail.find((m) => m.recipe.id === selectedId) : null,
    [selectedId, recipesWithAvail]
  )

  function handleSelect(id: string) {
    setSelectedId(id)
    setMobileDetailOpen(true)
  }

  function handleMobileBack() {
    setMobileDetailOpen(false)
  }

  function handleCooked() {
    if (!selectedId) return
    const recipe = recipes.find((r) => r.id === selectedId)
    if (!recipe) return
    try {
      batchUpdatePantry(recipe.ingredients.map((ing) => ({ ingredientId: ing.ingredientId, delta: -ing.quantity })))
    } catch { /* best-effort */ }
    setSelectedId(null)
    setMobileDetailOpen(false)
  }

  const selectedRecipe = selectedMeal?.recipe ?? null

  return (
    <div className="page page--fit">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1>Cook Now</h1>
        <div style={{ display: 'flex', flexDirection: 'row', gap: 6 }}>
          {FILTER_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              style={{
                borderRadius: 20,
                padding: '5px 14px',
                fontSize: 13,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: filter === tab ? 'var(--coral)' : 'var(--surface2)',
                color: filter === tab ? 'white' : 'var(--text-mid)',
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="page-body" style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Recipe list */}
        <div
          className="recipe-list-panel"
          style={{
            width: 280,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            borderRight: '1px solid var(--border)',
            overflow: 'hidden',
          }}
        >
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {cookable.length === 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', padding: '48px 16px', gap: 8, color: 'var(--text-dim)',
              }}>
                <span style={{ fontSize: 40 }}>🥘</span>
                <span style={{ fontSize: 13, textAlign: 'center' }}>
                  Add ingredients to your pantry to see what you can cook.
                </span>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', padding: '48px 16px', gap: 8, color: 'var(--text-dim)',
              }}>
                <span style={{ fontSize: 40 }}>{filter === 'Ready' ? '✅' : '⏳'}</span>
                <span style={{ fontSize: 13, textAlign: 'center' }}>
                  {filter === 'Ready' ? 'No recipes ready right now' : 'No almost-ready recipes'}
                </span>
              </div>
            ) : (
              filtered.map(({ recipe, avail }) => {
                const recipeTags = tags.filter((t) => recipe.tagIds.includes(t.id))
                const isSelected = recipe.id === selectedId
                return (
                  <div
                    key={recipe.id}
                    onClick={() => handleSelect(recipe.id)}
                    style={{
                      padding: '10px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border)',
                      background: isSelected ? 'var(--surface3)' : 'transparent',
                      transition: 'background 0.1s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'var(--surface2)'
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'transparent'
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 20, lineHeight: 1 }}>{recipe.emoji || '🍽️'}</span>
                        <span style={{
                          fontSize: 13, fontWeight: 600, color: 'var(--text)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {recipe.name}
                        </span>
                      </div>
                      {recipeTags.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, paddingLeft: 28 }}>
                          {recipeTags.map((tag) => (
                            <TagChip key={tag.id} name={tag.name} color={tag.color} size="sm" />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Missing count or ready indicator */}
                    <div style={{ flexShrink: 0, minWidth: 20, textAlign: 'right' }}>
                      {avail.tier === 'ready' ? (
                        <span style={{
                          display: 'inline-block', width: 8, height: 8,
                          borderRadius: '50%', background: 'var(--coral)',
                        }} />
                      ) : (
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--amber)' }}>
                          {avail.missingCount}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right panel — desktop only */}
        <div className="recipe-detail-panel" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <RecipeDetail
            recipeId={selectedId}
            context="cook-now"
            ingredientAvailability={selectedMeal?.avail.ingredientAvailability}
            onEdit={selectedId ? () => setEditOpen(true) : undefined}
            onAddToWeek={selectedId ? () => setAddToWeekOpen(true) : undefined}
            onCooked={selectedId ? handleCooked : undefined}
          />
        </div>

        {/* Mobile overlay */}
        <div
          aria-hidden={!mobileDetailOpen}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            background: 'var(--surface)',
            display: 'flex',
            flexDirection: 'column',
            transform: mobileDetailOpen ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.25s ease',
          }}
        >
          <div style={{
            display: 'flex', alignItems: 'center', padding: '8px 4px',
            borderBottom: '1px solid var(--border)', flexShrink: 0,
          }}>
            <IconButton variant="default" onClick={handleMobileBack} aria-label="Back">
              <ChevronLeft size={20} />
            </IconButton>
            <span style={{ fontSize: 15, fontWeight: 700, marginLeft: 4 }}>
              {selectedRecipe?.name ?? 'Recipe'}
            </span>
          </div>
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
            <RecipeDetail
              recipeId={selectedId}
              context="cook-now"
              ingredientAvailability={selectedMeal?.avail.ingredientAvailability}
              onEdit={selectedId ? () => setEditOpen(true) : undefined}
              onAddToWeek={selectedId ? () => setAddToWeekOpen(true) : undefined}
              onCooked={selectedId ? handleCooked : undefined}
            />
          </div>
        </div>
      </div>

      {editOpen && selectedRecipe && (
        <AddEditRecipeModal
          mode="edit"
          recipe={selectedRecipe}
          onClose={() => setEditOpen(false)}
        />
      )}
      {addToWeekOpen && selectedId && (() => {
        const recipe = recipes.find((r) => r.id === selectedId)
        return recipe ? (
          <AddToWeekModal
            recipeId={selectedId}
            defaultServings={recipe.servings}
            weekStart={weekStart}
            onClose={() => setAddToWeekOpen(false)}
          />
        ) : null
      })()}
    </div>
  )
}

