import { Outlet } from 'react-router-dom'
import { useIsMutating, useQueries } from '@tanstack/react-query'
import Sidebar from './components/nav/Sidebar'
import BottomNav from './components/nav/BottomNav'
import SettingsGear from './components/nav/SettingsGear'
import { SavingIndicator } from './components/ui/SavingIndicator'
import { ToastHost } from './components/ui/ToastHost'
import { GateLoader, ServerErrorPanel } from './components/shared/ServerGate'
import { recipesQueryOptions } from './api/recipes'
import { tagsQueryOptions } from './api/tags'
import { ingredientsQueryOptions } from './api/ingredients'
import { pantryQueryOptions } from './api/pantry'
import { mealPlanQueryOptions } from './api/mealPlan'

export default function AppShell() {
  // The gate: nothing below renders before all five lists are in the cache. Pages and modals then assume their
  // data exists. Once loaded, background refetches (and their failures) are silent.
  const lists = useQueries({
    queries: [recipesQueryOptions, tagsQueryOptions, ingredientsQueryOptions, pantryQueryOptions, mealPlanQueryOptions],
  })
  const writing = useIsMutating() > 0

  const loaded = lists.every((q) => q.data !== undefined)
  const failed = !loaded && lists.some((q) => q.isError)

  function retry() {
    for (const q of lists) if (q.isError) void q.refetch()
  }

  return (
    <>
      <SavingIndicator visible={writing} />
      <ToastHost />
      {!loaded ? (
        failed ? (
          <ServerErrorPanel onRetry={retry} />
        ) : (
          <GateLoader />
        )
      ) : (
        <div className="app">
          <Sidebar />
          <main
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              overflowY: 'auto',
              position: 'relative',
            }}
          >
            <SettingsGear />
            <Outlet />
          </main>
          <BottomNav />
        </div>
      )}
    </>
  )
}
