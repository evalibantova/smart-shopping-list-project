import { NavLink } from 'react-router-dom'
import { navItems } from './navItems'

export default function BottomNav() {
  return (
    <nav
      className="bottom-nav"
      aria-label="Mobile navigation"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '60px',
        background: 'var(--charcoal)',
        alignItems: 'stretch',
        zIndex: 100,
      }}
    >
      {navItems.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          style={({ isActive }) => ({
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            textDecoration: 'none',
            color: isActive ? 'var(--coral)' : 'var(--nav-text-inactive-mobile)',
            fontSize: '10px',
            fontWeight: 600,
          })}
        >
          <Icon size={20} strokeWidth={2} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
