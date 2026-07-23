import { useAuth } from '../auth/useAuth'
import { AdminAppHeader } from '../components/AdminAppHeader'

interface RoleLandingPageProps {
  eyebrow: string
  title: string
}

export function RoleLandingPage({ eyebrow, title }: RoleLandingPageProps) {
  const { session, logout } = useAuth()

  return (
    <div className="app-shell">
      <AdminAppHeader onSignOut={logout} />
      <main>
        <p className="eyebrow">{eyebrow}</p>
        <h1>Welcome, {session?.username}</h1>
        <p>{title}</p>
      </main>
    </div>
  )
}
