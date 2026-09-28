import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { RecipesPage } from './features/recipes/RecipesPage'
import { MealPlannerPage } from './features/meal-planner/MealPlannerPage'
import { ShoppingListPage } from './features/shopping-list/ShoppingListPage'
import { PantryPage } from './features/pantry/PantryPage'
import { CookNowPage } from './features/cook-now/CookNowPage'
import { useStore } from './store'

function AppLoader() {
  const { loadRecipes, loadMealPlan, loadIngredientsDb, loadTags, loadPantry } = useStore()

  useEffect(() => {
    loadIngredientsDb()
    loadRecipes()
    loadMealPlan()
    loadTags()
    loadPantry()
  }, [])

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/recipes" replace />} />
        <Route path="/recipes" element={<RecipesPage />} />
        <Route path="/meal-planner" element={<MealPlannerPage />} />
        <Route path="/cook-now" element={<CookNowPage />} />
        <Route path="/shopping-list" element={<ShoppingListPage />} />
        <Route path="/pantry" element={<PantryPage />} />
        <Route path="*" element={<Navigate to="/recipes" replace />} />
      </Routes>
    </AppShell>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLoader />
    </BrowserRouter>
  )
}
