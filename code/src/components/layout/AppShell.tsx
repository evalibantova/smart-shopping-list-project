import { type ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { Toast } from '../ui/Toast'
import { SavingIndicator } from '../ui/SavingIndicator'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <Sidebar />
      <div className="page">
        {children}
      </div>
      <BottomNav />
      <Toast />
      <SavingIndicator />
    </div>
  )
}
