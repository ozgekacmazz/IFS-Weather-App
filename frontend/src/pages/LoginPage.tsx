import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

const genericLoginError =
  'Sign-in failed. Check your credentials and account status, then try again.'

interface LoginLocationState {
  from?: string
}

export function LoginPage() {
  const { session, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [usernameOrEmail, setUsernameOrEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (session) {
    return <Navigate to="/app" replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)
    setIsSubmitting(true)

    try {
      await login({ usernameOrEmail: usernameOrEmail.trim(), password })
      const requestedPath = (location.state as LoginLocationState | null)?.from
      navigate(requestedPath?.startsWith('/app') ? requestedPath : '/app', {
        replace: true,
      })
    } catch {
      setPassword('')
      setErrorMessage(genericLoginError)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-layout">
      <section className="brand-panel" aria-label="IFS Weather introduction">
        <div>
          <p className="eyebrow">IFS Weather</p>
          <h1>Weather intelligence, made clear.</h1>
          <p className="brand-copy">
            Sign in to access your secure weather workspace and personalized
            forecasts.
          </p>
        </div>
        <p className="brand-note">Reliable forecasts. Thoughtful decisions.</p>
      </section>

      <section className="form-panel">
        <div className="login-card">
          <div className="mobile-brand" aria-hidden="true">
            IFS Weather
          </div>
          <p className="eyebrow">Welcome back</p>
          <h2>Sign in to your account</h2>
          <p className="form-intro">Enter your username or email to continue.</p>

          <form onSubmit={handleSubmit}>
            <label htmlFor="usernameOrEmail">Username or email</label>
            <input
              id="usernameOrEmail"
              name="usernameOrEmail"
              type="text"
              autoComplete="username"
              value={usernameOrEmail}
              onChange={(event) => setUsernameOrEmail(event.target.value)}
              disabled={isSubmitting}
              required
              autoFocus
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isSubmitting}
              required
            />

            {errorMessage ? (
              <div className="error-message" role="alert">
                {errorMessage}
              </div>
            ) : null}

            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}
