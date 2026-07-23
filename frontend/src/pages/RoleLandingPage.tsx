import { useAuth } from '../auth/useAuth'
import { getRoleHomePath } from '../auth/authNavigation'

interface RoleLandingPageProps {
  eyebrow: string
  title: string
}

export function RoleLandingPage({ eyebrow, title }: RoleLandingPageProps) {
  const { session, logout } = useAuth()

  return (
    <div className="app-shell">
      <header>
        <a className="app-logo" href={getRoleHomePath(session!.role)}>
          IFS Weather
        </a>
        <button className="secondary-button" type="button" onClick={logout}>
          Sign out
        </button>
      </header>
      <main>
        <p className="eyebrow">{eyebrow}</p>
        <h1>Welcome, {session?.username}</h1>
        <p>{title}</p>
      </main>
    </div>
  )
}
