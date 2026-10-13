import { Link, useLocation } from 'react-router-dom'
import { Settings } from 'lucide-react'

/** Mobile entry to Settings: sits in the page header area. Hidden on desktop by CSS (the sidebar has the link). */
export default function SettingsGear() {
  const { pathname } = useLocation()
  if (pathname === '/settings') return null
  return (
    <Link to="/settings" className="settings-gear" aria-label="Settings">
      <Settings size={20} />
    </Link>
  )
}
