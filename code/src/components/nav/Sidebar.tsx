import { NavLink } from 'react-router-dom'
import { UtensilsCrossed, Calendar, ShoppingCart, Package, Flame } from 'lucide-react'

const NAV_ITEMS = [
  { label: 'Recipes',       path: '/recipes',       Icon: UtensilsCrossed },
  { label: 'Meal Planner',  path: '/meal-planner',  Icon: Calendar },
  { label: 'Shopping List', path: '/shopping-list', Icon: ShoppingCart },
  { label: 'Pantry',        path: '/pantry',        Icon: Package },
  { label: 'Cook Now',      path: '/cook-now',      Icon: Flame },
]

export default function Sidebar() {
  return (
    <nav className="sidebar" data-testid="sidebar" aria-label="Main navigation">
      {NAV_ITEMS.map(({ label, path, Icon }) => (
        <NavLink
          key={path}
          to={path}
          className={({ isActive }) =>
            isActive ? 'nav-link nav-link--active' : 'nav-link'
          }
        >
          <Icon size={20} aria-hidden="true" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
