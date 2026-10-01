import { Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './AppShell'
import RecipesPage from './features/recipes/RecipesPage'
import MealPlannerPage from './features/meal-planner/MealPlannerPage'
import ShoppingListPage from './features/shopping-list/ShoppingListPage'
import PantryPage from './features/pantry/PantryPage'
import CookNowPage from './features/cook-now/CookNowPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AppShell />}>
        <Route index element={<Navigate to="/recipes" replace />} />
        <Route path="recipes" element={<RecipesPage />} />
        <Route path="meal-planner" element={<MealPlannerPage />} />
        <Route path="shopping-list" element={<ShoppingListPage />} />
        <Route path="pantry" element={<PantryPage />} />
        <Route path="cook-now" element={<CookNowPage />} />
      </Route>
    </Routes>
  )
}
