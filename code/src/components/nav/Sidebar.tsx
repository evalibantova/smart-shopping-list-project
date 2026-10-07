import { NavLink } from 'react-router-dom'
import { navItems } from './navItems'

export default function Sidebar() {
  return (
    <nav
      className="sidebar"
      aria-label="Main navigation"
      style={{
        width: '220px',
        flexDirection: 'column',
        flexShrink: 0,
        height: '100vh',
        background: 'var(--charcoal)',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          padding: '20px 16px 12px',
          fontSize: '17px',
          fontWeight: 800,
          color: 'var(--nav-text-active)',
          letterSpacing: '-0.02em',
        }}
      >
        Meal Planner
      </div>

      <ul
        style={{
          listStyle: 'none',
          padding: '8px 0',
          flex: 1,
        }}
      >
        {navItems.map(({ to, label, Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 16px',
                fontSize: '14px',
                fontWeight: 500,
                textDecoration: 'none',
                color: isActive ? 'var(--nav-text-active)' : 'var(--nav-text-inactive)',
                background: isActive ? 'var(--coral)' : 'transparent',
                transition: 'opacity 0.15s',
              })}
            >
              <Icon size={20} strokeWidth={2} />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>

      <div
        style={{
          padding: '12px 16px',
          fontSize: '11px',
          color: 'var(--nav-footer)',
        }}
      >
        MVP v0.1
      </div>
    </nav>
  )
}
