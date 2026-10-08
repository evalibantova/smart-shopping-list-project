import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './components/nav/Sidebar'
import BottomNav from './components/nav/BottomNav'
import { useStore } from './store'

export default function AppShell() {
  const recipes = useStore((s) => s.recipes)
  const entries = useStore((s) => s.entries)
  const initRecipes = useStore((s) => s.initRecipes)
  const initMealPlan = useStore((s) => s.initMealPlan)

  useEffect(() => {
    if (recipes.length === 0) initRecipes()
    if (entries.length === 0) initMealPlan()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="app">
      <Sidebar />
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflowY: 'auto',
        }}
      >
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
