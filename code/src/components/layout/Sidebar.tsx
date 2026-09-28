import { NavLink } from 'react-router-dom'
import { UtensilsCrossed, CalendarDays, ShoppingCart, Package, ChefHat } from 'lucide-react'

const navItems = [
  { to: '/recipes', icon: UtensilsCrossed, label: 'Recipes' },
  { to: '/meal-planner', icon: CalendarDays, label: 'Meal Planner' },
  { to: '/cook-now', icon: ChefHat, label: 'Cook Now' },
  { to: '/shopping-list', icon: ShoppingCart, label: 'Shopping List' },
  { to: '/pantry', icon: Package, label: 'Pantry' },
]

export function Sidebar() {
  return (
    <nav className="sidebar">
      <div className="sidebar-brand">🛒 Smart Shopping</div>
      <div className="sidebar-nav">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}
      </div>
      <div className="sidebar-footer">v1 · MVP</div>
    </nav>
  )
}
