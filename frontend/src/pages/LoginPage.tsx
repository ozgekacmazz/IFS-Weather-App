import { useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { getSafePostAuthenticationPath } from '../auth/authNavigation'
import { useAuth } from '../auth/useAuth'

const genericLoginError =
  'Sign-in failed. Your credentials may be incorrect, or your account may be temporarily unavailable. Check your information or try again shortly.'

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
  const submissionInProgress = useRef(false)

  if (session) {
    const requestedPath = (location.state as LoginLocationState | null)?.from
    return (
      <Navigate
        to={getSafePostAuthenticationPath(session.role, requestedPath)}
        replace
      />
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (submissionInProgress.current) {
      return
    }

    submissionInProgress.current = true
    setErrorMessage(null)
    setIsSubmitting(true)

    try {
      const authenticatedSession = await login({
        usernameOrEmail: usernameOrEmail.trim(),
        password,
      })
      const requestedPath = (location.state as LoginLocationState | null)?.from
      navigate(
        getSafePostAuthenticationPath(
          authenticatedSession.role,
          requestedPath,
        ),
        { replace: true },
      )
    } catch {
      setPassword('')
      setErrorMessage(genericLoginError)
    } finally {
      submissionInProgress.current = false
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
          <p className="auth-switch">
            New to IFS Weather? <Link to="/register">Create an account</Link>
          </p>
        </div>
      </section>
    </main>
  )
}
