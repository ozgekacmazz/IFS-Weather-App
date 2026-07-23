import { NavLink } from 'react-router-dom'

interface UserAppHeaderProps {
  onSignOut: () => void
}

export function UserAppHeader({ onSignOut }: UserAppHeaderProps) {
  return (
    <header className="dashboard-header user-app-header">
      <NavLink className="app-logo" to="/app/weather">
        IFS Weather
      </NavLink>
      <nav className="user-navigation" aria-label="User navigation">
        <NavLink
          to="/app/weather"
          className={({ isActive }) => (isActive ? 'active' : undefined)}
        >
          Weather
        </NavLink>
        <NavLink
          to="/app/profile"
          className={({ isActive }) => (isActive ? 'active' : undefined)}
        >
          Profile
        </NavLink>
      </nav>
      <button className="secondary-button" type="button" onClick={onSignOut}>
        Sign out
      </button>
    </header>
  )
}
