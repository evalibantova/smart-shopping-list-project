import {
  UtensilsCrossed,
  CalendarDays,
  Package,
  ChefHat,
  ShoppingCart,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  Icon: LucideIcon
}

export const navItems: NavItem[] = [
  { to: '/recipes', label: 'Recipes', Icon: UtensilsCrossed },
  { to: '/meal-planner', label: 'Meal Planner', Icon: CalendarDays },
  { to: '/pantry', label: 'Pantry', Icon: Package },
  { to: '/cook-now', label: 'Cook Now', Icon: ChefHat },
  { to: '/shopping-list', label: 'Shopping List', Icon: ShoppingCart },
]
