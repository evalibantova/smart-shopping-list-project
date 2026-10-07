import { Outlet } from 'react-router-dom'
import Sidebar from './components/nav/Sidebar'
import BottomNav from './components/nav/BottomNav'

export default function AppShell() {
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
