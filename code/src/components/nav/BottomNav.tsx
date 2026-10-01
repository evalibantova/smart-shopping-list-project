import { NavLink } from 'react-router-dom'
import { UtensilsCrossed, Calendar, ShoppingCart, Package, Flame } from 'lucide-react'

// Mobile nav order per DESIGN.md: Recipes · Meal Planner · Pantry · Cook Now · Shopping List
const MOBILE_NAV_ITEMS = [
  { label: 'Recipes',       path: '/recipes',       Icon: UtensilsCrossed },
  { label: 'Meal Planner',  path: '/meal-planner',  Icon: Calendar },
  { label: 'Pantry',        path: '/pantry',        Icon: Package },
  { label: 'Cook Now',      path: '/cook-now',      Icon: Flame },
  { label: 'Shopping List', path: '/shopping-list', Icon: ShoppingCart },
]

export default function BottomNav() {
  return (
    <nav className="bottom-nav" data-testid="bottom-nav" aria-label="Main navigation">
      {MOBILE_NAV_ITEMS.map(({ label, path, Icon }) => (
        <NavLink
          key={path}
          to={path}
          className={({ isActive }) =>
            isActive ? 'bottom-nav-item bottom-nav-item--active' : 'bottom-nav-item'
          }
        >
          {({ isActive }) => (
            <>
              <Icon
                size={20}
                className={isActive ? 'bottom-nav-icon--active' : 'bottom-nav-icon'}
                aria-hidden="true"
              />
              <span className={isActive ? 'bottom-nav-label--active' : 'bottom-nav-label'}>
                {label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
