import { NavLink } from 'react-router-dom'

interface AdminAppHeaderProps {
  onSignOut: () => void
}

export function AdminAppHeader({ onSignOut }: AdminAppHeaderProps) {
  return (
    <header className="dashboard-header user-app-header">
      <NavLink className="app-logo" end to="/app/admin">
        IFS Weather
      </NavLink>
      <nav className="user-navigation" aria-label="Admin navigation">
        <NavLink
          end
          to="/app/admin"
          className={({ isActive }) => (isActive ? 'active' : undefined)}
        >
          Overview
        </NavLink>
        <NavLink
          to="/app/admin/users"
          className={({ isActive }) => (isActive ? 'active' : undefined)}
        >
          Users
        </NavLink>
      </nav>
      <button className="secondary-button" type="button" onClick={onSignOut}>
        Sign out
      </button>
    </header>
  )
}
