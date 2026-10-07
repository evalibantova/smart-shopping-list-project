import { Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './AppShell'
import RecipesPage from './features/recipes'
import MealPlannerPage from './features/meal-planner'
import ShoppingListPage from './features/shopping-list'
import PantryPage from './features/pantry'
import CookNowPage from './features/cook-now'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/recipes" replace />} />
        <Route path="/recipes" element={<RecipesPage />} />
        <Route path="/meal-planner" element={<MealPlannerPage />} />
        <Route path="/shopping-list" element={<ShoppingListPage />} />
        <Route path="/pantry" element={<PantryPage />} />
        <Route path="/cook-now" element={<CookNowPage />} />
        <Route path="*" element={<Navigate to="/recipes" replace />} />
      </Route>
    </Routes>
  )
}
