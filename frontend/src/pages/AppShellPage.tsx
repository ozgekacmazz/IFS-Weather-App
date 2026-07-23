import { useAuth } from '../auth/useAuth'

export function AppShellPage() {
  const { session, logout } = useAuth()

  return (
    <div className="app-shell">
      <header>
        <a className="app-logo" href="/app">
          IFS Weather
        </a>
        <button className="secondary-button" type="button" onClick={logout}>
          Sign out
        </button>
      </header>
      <main>
        <p className="eyebrow">Secure workspace</p>
        <h1>Welcome, {session?.username}</h1>
        <p>Your weather dashboard foundation is ready.</p>
      </main>
    </div>
  )
}
