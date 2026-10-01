import { Outlet } from 'react-router-dom'
import { useIsMobile } from './hooks/useIsMobile'
import Sidebar from './components/nav/Sidebar'
import BottomNav from './components/nav/BottomNav'

export default function AppShell() {
  const isMobile = useIsMobile()
  return (
    <div className="app">
      {!isMobile && <Sidebar />}
      <main className={isMobile ? 'page page--mobile' : 'page'}>
        <Outlet />
      </main>
      {isMobile && <BottomNav />}
    </div>
  )
}
