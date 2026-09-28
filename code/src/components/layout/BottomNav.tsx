import { NavLink } from 'react-router-dom'
import { UtensilsCrossed, CalendarDays, ShoppingCart, Package, ChefHat } from 'lucide-react'

const navItems = [
  { to: '/recipes', icon: UtensilsCrossed, label: 'Recipes' },
  { to: '/meal-planner', icon: CalendarDays, label: 'Meal Planner' },
  { to: '/pantry', icon: Package, label: 'Pantry' },
  { to: '/cook-now', icon: ChefHat, label: 'Cook Now' },
  { to: '/shopping-list', icon: ShoppingCart, label: 'Shopping List' },
]

export function BottomNav() {
  return (
    <nav className="bottom-nav">
      {navItems.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}
        >
          <item.icon size={20} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
