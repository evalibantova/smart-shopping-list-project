import { useStore } from '../../store'
import { computeCookNowCards } from './cookNowSelector'
import type { CookNowCard } from './cookNowSelector'

const SLOT_LABEL: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
}

function cardGlow(availability: CookNowCard['availability']): string {
  if (availability === 'ready') {
    return '0 0 0 2px var(--coral-border), var(--shadow-sm)'
  }
  if (availability === 'almost') {
    return '0 0 0 2px rgba(245,166,35,0.3), var(--shadow-sm)'
  }
  // far
  return 'var(--shadow-sm)'
}

function emojiBg(availability: CookNowCard['availability']): string {
  if (availability === 'ready') return 'var(--coral-pale)'
  if (availability === 'almost') return 'var(--amber-pale)'
  return 'var(--red-pale)'
}

interface MealCardProps {
  card: CookNowCard
  onCookPress?: () => void
}

function MealCard({ card, onCookPress = () => {} }: MealCardProps) {
  const isReady = card.availability === 'ready'
  const isAlmost = card.availability === 'almost'
  const isFar = card.availability === 'far'

  return (
    <div
      data-testid="cook-now-card"
      data-availability={card.availability}
      style={{
        background: 'var(--surface)',
        borderRadius: 4,
        boxShadow: cardGlow(card.availability),
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        opacity: isFar ? 0.55 : 1,
      }}
    >
      {/* Emoji badge */}
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: emojiBg(card.availability),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          flexShrink: 0,
        }}
      >
        {card.emoji}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
          {card.recipeName}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-mid)', marginTop: 2 }}>
          {SLOT_LABEL[card.slot]} · {card.servings} serving{card.servings !== 1 ? 's' : ''}
        </div>

        {/* Availability badge */}
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          {isReady && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--coral)',
              }}
            >
              <span style={{ fontSize: 8 }}>●</span> Ready
            </span>
          )}
          {isAlmost && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--amber)',
              }}
            >
              {card.missingCount} missing
            </span>
          )}
          {isFar && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--red)',
              }}
            >
              {card.missingCount} missing
            </span>
          )}
        </div>
      </div>

      {/* CTA button */}
      {isReady && (
        <button
          aria-label="Cook it"
          onClick={onCookPress}
          style={{
            padding: '8px 16px',
            background: 'var(--charcoal)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 4,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          Cook it
        </button>
      )}
      {isAlmost && (
        <button
          aria-label="Cook anyway"
          onClick={onCookPress}
          style={{
            padding: '8px 16px',
            background: 'transparent',
            color: 'var(--amber)',
            border: '1.5px solid var(--amber)',
            borderRadius: 4,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          Cook anyway
        </button>
      )}
    </div>
  )
}

export default function CookNowPage() {
  const entries = useStore((s) => s.entries)
  const recipes = useStore((s) => s.recipes)
  const pantryItems = useStore((s) => s.pantryItems)

  const today = new Date().toISOString().slice(0, 10)
  const cards = computeCookNowCards(entries, recipes, pantryItems, today)

  return (
    <div className="page">
      <div className="page-header">
        <h1>Cook Now</h1>
      </div>

      {cards.length === 0 ? (
        <div
          data-testid="cook-now-empty"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '64px 24px',
            gap: 12,
            flex: 1,
          }}
        >
          <span style={{ fontSize: 56 }}>🍽️</span>
          <span
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--text-mid)',
              textAlign: 'center',
            }}
          >
            Nothing planned for today
          </span>
          <span
            style={{
              fontSize: 13,
              color: 'var(--text-dim)',
              textAlign: 'center',
              maxWidth: 280,
            }}
          >
            Add meals to today in your meal planner and they'll appear here.
          </span>
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 16px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {cards.map((card) => (
            <MealCard key={card.entryId} card={card} />
          ))}
        </div>
      )}
    </div>
  )
}
