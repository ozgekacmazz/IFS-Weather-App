import { useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ApiError } from '../api/apiError'
import { getRoleHomePath } from '../auth/authNavigation'
import { useAuth } from '../auth/useAuth'

interface RegistrationFields {
  firstName: string
  lastName: string
  username: string
  email: string
  password: string
  defaultCity: string
}

type RegistrationErrors = Partial<Record<keyof RegistrationFields, string>>

const initialFields: RegistrationFields = {
  firstName: '',
  lastName: '',
  username: '',
  email: '',
  password: '',
  defaultCity: '',
}

const usernamePattern = /^[a-zA-Z0-9_.-]+$/
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateRegistration(fields: RegistrationFields): RegistrationErrors {
  const errors: RegistrationErrors = {}
  const firstName = fields.firstName.trim()
  const lastName = fields.lastName.trim()
  const username = fields.username.trim()
  const email = fields.email.trim()
  const defaultCity = fields.defaultCity.trim()

  if (!firstName) {
    errors.firstName = 'First name is required.'
  } else if (firstName.length > 100) {
    errors.firstName = 'First name must be 100 characters or fewer.'
  }

  if (!lastName) {
    errors.lastName = 'Last name is required.'
  } else if (lastName.length > 100) {
    errors.lastName = 'Last name must be 100 characters or fewer.'
  }

  if (!username) {
    errors.username = 'Username is required.'
  } else if (username.length < 3 || username.length > 50) {
    errors.username = 'Username must be between 3 and 50 characters.'
  } else if (!usernamePattern.test(username)) {
    errors.username =
      'Use only letters, numbers, underscores, dots, or hyphens.'
  }

  if (!email) {
    errors.email = 'Email is required.'
  } else if (email.length > 256 || !emailPattern.test(email)) {
    errors.email = 'Enter a valid email address of 256 characters or fewer.'
  }

  if (!fields.password) {
    errors.password = 'Password is required.'
  } else if (
    fields.password.length < 8 ||
    !/[A-Z]/.test(fields.password) ||
    !/[a-z]/.test(fields.password) ||
    !/[0-9]/.test(fields.password)
  ) {
    errors.password =
      'Use at least 8 characters with uppercase, lowercase, and a number.'
  }

  if (defaultCity.length > 100) {
    errors.defaultCity = 'Default city must be 100 characters or fewer.'
  }

  return errors
}

export function RegisterPage() {
  const { session, register } = useAuth()
  const navigate = useNavigate()
  const [fields, setFields] = useState(initialFields)
  const [errors, setErrors] = useState<RegistrationErrors>({})
  const [requestError, setRequestError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submissionInProgress = useRef(false)

  if (session) {
    return <Navigate to={getRoleHomePath(session.role)} replace />
  }

  function updateField(field: keyof RegistrationFields, value: string) {
    setFields((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (submissionInProgress.current) {
      return
    }

    const validationErrors = validateRegistration(fields)
    setErrors(validationErrors)
    setRequestError(null)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    submissionInProgress.current = true
    setIsSubmitting(true)

    try {
      const authenticatedSession = await register({
        firstName: fields.firstName.trim(),
        lastName: fields.lastName.trim(),
        username: fields.username.trim(),
        email: fields.email.trim(),
        password: fields.password,
        defaultCity: fields.defaultCity.trim() || null,
      })
      navigate(getRoleHomePath(authenticatedSession.role), { replace: true })
    } catch (error: unknown) {
      setFields((current) => ({ ...current, password: '' }))
      setRequestError(
        error instanceof ApiError && error.status === 409
          ? 'That username or email is already in use.'
          : 'Registration could not be completed. Check your information and try again.',
      )
    } finally {
      submissionInProgress.current = false
      setIsSubmitting(false)
    }
  }

  function fieldProps(field: keyof RegistrationFields) {
    const error = errors[field]
    return {
      'aria-invalid': error ? true : undefined,
      'aria-describedby': error ? `${field}-error` : undefined,
    }
  }

  return (
    <main className="auth-layout">
      <section className="brand-panel" aria-label="IFS Weather introduction">
        <div>
          <p className="eyebrow">IFS Weather</p>
          <h1>Start with weather that feels personal.</h1>
          <p className="brand-copy">
            Create your secure account and prepare a workspace around the city
            that matters to you.
          </p>
        </div>
        <p className="brand-note">Reliable forecasts. Thoughtful decisions.</p>
      </section>

      <section className="form-panel">
        <div className="login-card registration-card">
          <p className="eyebrow">Get started</p>
          <h2>Create your account</h2>
          <p className="form-intro">All fields are required except default city.</p>

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-grid">
              <div>
                <label htmlFor="firstName">First name</label>
                <input
                  id="firstName"
                  value={fields.firstName}
                  onChange={(event) => updateField('firstName', event.target.value)}
                  disabled={isSubmitting}
                  autoComplete="given-name"
                  maxLength={101}
                  {...fieldProps('firstName')}
                />
                <FieldError field="firstName" message={errors.firstName} />
              </div>
              <div>
                <label htmlFor="lastName">Last name</label>
                <input
                  id="lastName"
                  value={fields.lastName}
                  onChange={(event) => updateField('lastName', event.target.value)}
                  disabled={isSubmitting}
                  autoComplete="family-name"
                  maxLength={101}
                  {...fieldProps('lastName')}
                />
                <FieldError field="lastName" message={errors.lastName} />
              </div>
            </div>

            <label htmlFor="username">Username</label>
            <input
              id="username"
              value={fields.username}
              onChange={(event) => updateField('username', event.target.value)}
              disabled={isSubmitting}
              autoComplete="username"
              maxLength={51}
              {...fieldProps('username')}
            />
            <FieldError field="username" message={errors.username} />

            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={fields.email}
              onChange={(event) => updateField('email', event.target.value)}
              disabled={isSubmitting}
              autoComplete="email"
              maxLength={257}
              {...fieldProps('email')}
            />
            <FieldError field="email" message={errors.email} />

            <label htmlFor="newPassword">Password</label>
            <input
              id="newPassword"
              type="password"
              value={fields.password}
              onChange={(event) => updateField('password', event.target.value)}
              disabled={isSubmitting}
              autoComplete="new-password"
              {...fieldProps('password')}
            />
            <FieldError field="password" message={errors.password} />

            <label htmlFor="defaultCity">Default city (optional)</label>
            <input
              id="defaultCity"
              value={fields.defaultCity}
              onChange={(event) => updateField('defaultCity', event.target.value)}
              disabled={isSubmitting}
              autoComplete="address-level2"
              maxLength={101}
              {...fieldProps('defaultCity')}
            />
            <FieldError field="defaultCity" message={errors.defaultCity} />

            {requestError ? (
              <div className="error-message" role="alert">
                {requestError}
              </div>
            ) : null}

            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="auth-switch">
            Already registered? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </section>
    </main>
  )
}

function FieldError({
  field,
  message,
}: {
  field: keyof RegistrationFields
  message?: string
}) {
  return message ? (
    <p className="field-error" id={`${field}-error`}>
      {message}
    </p>
  ) : null
}
