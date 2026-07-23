import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { ApiError } from '../api/apiError'
import {
  getProfile,
  updateProfile,
  type UserProfile,
} from '../api/profileApi'
import { useAuth } from '../auth/useAuth'
import { UserAppHeader } from '../components/UserAppHeader'

interface ProfileFields {
  firstName: string
  lastName: string
  defaultCity: string
  currentPassword: string
  newPassword: string
  confirmNewPassword: string
}

type ProfileErrors = Partial<Record<keyof ProfileFields, string>>

const emptyFields: ProfileFields = {
  firstName: '',
  lastName: '',
  defaultCity: '',
  currentPassword: '',
  newPassword: '',
  confirmNewPassword: '',
}

const loadFailureMessage =
  'Your profile could not be loaded. Please try again.'
const updateFailureMessage =
  'Your profile could not be updated. Check your information and try again.'

function fieldsFromProfile(profile: UserProfile): ProfileFields {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    defaultCity: profile.defaultCity ?? '',
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  }
}

function validateProfile(fields: ProfileFields): ProfileErrors {
  const errors: ProfileErrors = {}
  const firstName = fields.firstName.trim()
  const lastName = fields.lastName.trim()
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

  if (defaultCity.length > 100) {
    errors.defaultCity = 'Default city must be 100 characters or fewer.'
  }

  const passwordChangeRequested =
    fields.currentPassword.length > 0 ||
    fields.newPassword.length > 0 ||
    fields.confirmNewPassword.length > 0

  if (passwordChangeRequested) {
    if (!fields.currentPassword) {
      errors.currentPassword = 'Current password is required.'
    }

    if (!fields.newPassword) {
      errors.newPassword = 'New password is required.'
    } else if (
      fields.newPassword.length < 8 ||
      !/[A-Z]/.test(fields.newPassword) ||
      !/[a-z]/.test(fields.newPassword) ||
      !/[0-9]/.test(fields.newPassword)
    ) {
      errors.newPassword =
        'Use at least 8 characters with uppercase, lowercase, and a number.'
    }

    if (!fields.confirmNewPassword) {
      errors.confirmNewPassword = 'Confirm your new password.'
    } else if (fields.confirmNewPassword !== fields.newPassword) {
      errors.confirmNewPassword = 'New password confirmation must match.'
    }
  }

  return errors
}

export function UserProfilePage() {
  const { apiClient, logout } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [fields, setFields] = useState(emptyFields)
  const [errors, setErrors] = useState<ProfileErrors>({})
  const [loadError, setLoadError] = useState<string | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const loadSequence = useRef(0)
  const mutationSequence = useRef(0)
  const confirmedMutationVersion = useRef(0)
  const submissionInProgress = useRef(false)
  const isMounted = useRef(true)

  const handleUnauthorized = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && error.status === 401) {
        logout()
        return true
      }

      return false
    },
    [logout],
  )

  const loadProfile = useCallback(async () => {
    if (submissionInProgress.current) {
      return
    }

    const requestId = ++loadSequence.current
    const mutationVersion = confirmedMutationVersion.current
    setIsLoading(true)
    setLoadError(null)
    setSuccessMessage(null)

    try {
      const loadedProfile = await getProfile(apiClient)

      if (
        !isMounted.current ||
        loadSequence.current !== requestId ||
        confirmedMutationVersion.current !== mutationVersion
      ) {
        return
      }

      setProfile(loadedProfile)
      setFields(fieldsFromProfile(loadedProfile))
      setErrors({})
    } catch (error: unknown) {
      if (
        isMounted.current &&
        loadSequence.current === requestId &&
        confirmedMutationVersion.current === mutationVersion &&
        !handleUnauthorized(error)
      ) {
        setProfile(null)
        setLoadError(loadFailureMessage)
      }
    } finally {
      if (
        isMounted.current &&
        loadSequence.current === requestId &&
        confirmedMutationVersion.current === mutationVersion
      ) {
        setIsLoading(false)
      }
    }
  }, [apiClient, handleUnauthorized])

  useEffect(() => {
    isMounted.current = true
    const timeoutId = window.setTimeout(() => {
      void loadProfile()
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
      isMounted.current = false
      loadSequence.current += 1
      mutationSequence.current += 1
    }
  }, [loadProfile])

  function updateField(field: keyof ProfileFields, value: string) {
    setFields((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setUpdateError(null)
    setSuccessMessage(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (submissionInProgress.current || !profile) {
      return
    }

    const validationErrors = validateProfile(fields)
    setErrors(validationErrors)
    setUpdateError(null)
    setSuccessMessage(null)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    submissionInProgress.current = true
    setIsSaving(true)
    const mutationId = ++mutationSequence.current
    loadSequence.current += 1
    setIsLoading(false)
    const passwordChangeRequested =
      fields.currentPassword.length > 0 ||
      fields.newPassword.length > 0 ||
      fields.confirmNewPassword.length > 0

    try {
      const updatedProfile = await updateProfile(apiClient, {
        firstName: fields.firstName.trim(),
        lastName: fields.lastName.trim(),
        defaultCity: fields.defaultCity.trim() || null,
        currentPassword: passwordChangeRequested
          ? fields.currentPassword
          : null,
        newPassword: passwordChangeRequested ? fields.newPassword : null,
      })

      if (
        !isMounted.current ||
        mutationSequence.current !== mutationId
      ) {
        return
      }

      confirmedMutationVersion.current += 1
      setIsLoading(false)
      setProfile(updatedProfile)
      setFields(fieldsFromProfile(updatedProfile))
      setErrors({})
      setSuccessMessage('Your profile has been updated.')
    } catch (error: unknown) {
      if (
        isMounted.current &&
        mutationSequence.current === mutationId
      ) {
        setFields(fieldsFromProfile(profile))

        if (!handleUnauthorized(error)) {
          setUpdateError(updateFailureMessage)
        }
      }
    } finally {
      submissionInProgress.current = false

      if (isMounted.current && mutationSequence.current === mutationId) {
        setIsSaving(false)
      }
    }
  }

  function fieldProps(field: keyof ProfileFields) {
    const error = errors[field]
    return {
      'aria-invalid': error ? true : undefined,
      'aria-describedby': error ? `${field}-error` : undefined,
    }
  }

  return (
    <div className="weather-dashboard profile-page">
      <UserAppHeader onSignOut={logout} />
      <main className="profile-content">
        <header className="profile-intro">
          <p className="eyebrow">Account settings</p>
          <h1>Your profile</h1>
          <p>
            Keep your personal details, default city, and password up to date.
          </p>
        </header>

        {isLoading ? (
          <section className="dashboard-state" aria-live="polite">
            <h2>Loading your profile…</h2>
            <p>Retrieving your account information.</p>
          </section>
        ) : null}

        {!isLoading && !profile ? (
          <section className="dashboard-state">
            <h2>Profile unavailable</h2>
            <p role="alert">{loadError ?? loadFailureMessage}</p>
            <button type="button" onClick={() => void loadProfile()}>
              Try again
            </button>
          </section>
        ) : null}

        {!isLoading && profile ? (
          <form className="profile-form" onSubmit={handleSubmit} noValidate>
            <section aria-labelledby="account-information-title">
              <div className="profile-section-heading">
                <div>
                  <p className="eyebrow">Account</p>
                  <h2 id="account-information-title">Account information</h2>
                </div>
                <p>Username and email cannot be changed here.</p>
              </div>
              <div className="profile-grid">
                <div>
                  <label htmlFor="profile-username">Username</label>
                  <input
                    id="profile-username"
                    value={profile.username}
                    readOnly
                    autoComplete="username"
                  />
                </div>
                <div>
                  <label htmlFor="profile-email">Email</label>
                  <input
                    id="profile-email"
                    type="email"
                    value={profile.email}
                    readOnly
                    autoComplete="email"
                  />
                </div>
              </div>
            </section>

            <section aria-labelledby="personal-details-title">
              <div className="profile-section-heading">
                <div>
                  <p className="eyebrow">Personal details</p>
                  <h2 id="personal-details-title">Profile details</h2>
                </div>
              </div>
              <div className="profile-grid">
                <ProfileField
                  id="firstName"
                  label="First name"
                  value={fields.firstName}
                  onChange={(value) => updateField('firstName', value)}
                  disabled={isSaving}
                  autoComplete="given-name"
                  maxLength={101}
                  error={errors.firstName}
                  fieldProps={fieldProps('firstName')}
                />
                <ProfileField
                  id="lastName"
                  label="Last name"
                  value={fields.lastName}
                  onChange={(value) => updateField('lastName', value)}
                  disabled={isSaving}
                  autoComplete="family-name"
                  maxLength={101}
                  error={errors.lastName}
                  fieldProps={fieldProps('lastName')}
                />
              </div>
              <ProfileField
                id="defaultCity"
                label="Default city (optional)"
                value={fields.defaultCity}
                onChange={(value) => updateField('defaultCity', value)}
                disabled={isSaving}
                autoComplete="address-level2"
                maxLength={101}
                error={errors.defaultCity}
                fieldProps={fieldProps('defaultCity')}
              />
            </section>

            <section aria-labelledby="password-change-title">
              <div className="profile-section-heading">
                <div>
                  <p className="eyebrow">Security</p>
                  <h2 id="password-change-title">Change password</h2>
                </div>
                <p>Leave all password fields blank to keep your current password.</p>
              </div>
              <ProfileField
                id="currentPassword"
                label="Current password"
                type="password"
                value={fields.currentPassword}
                onChange={(value) => updateField('currentPassword', value)}
                disabled={isSaving}
                autoComplete="current-password"
                error={errors.currentPassword}
                fieldProps={fieldProps('currentPassword')}
              />
              <div className="profile-grid">
                <ProfileField
                  id="newPassword"
                  label="New password"
                  type="password"
                  value={fields.newPassword}
                  onChange={(value) => updateField('newPassword', value)}
                  disabled={isSaving}
                  autoComplete="new-password"
                  error={errors.newPassword}
                  fieldProps={fieldProps('newPassword')}
                />
                <ProfileField
                  id="confirmNewPassword"
                  label="Confirm new password"
                  type="password"
                  value={fields.confirmNewPassword}
                  onChange={(value) => updateField('confirmNewPassword', value)}
                  disabled={isSaving}
                  autoComplete="new-password"
                  error={errors.confirmNewPassword}
                  fieldProps={fieldProps('confirmNewPassword')}
                />
              </div>
            </section>

            {updateError ? (
              <div className="error-message profile-message" role="alert">
                {updateError}
              </div>
            ) : null}
            <div className="profile-success" aria-live="polite">
              {successMessage}
            </div>

            <div className="profile-actions">
              <button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving profile…' : 'Save profile'}
              </button>
            </div>
          </form>
        ) : null}
      </main>
    </div>
  )
}

interface ProfileFieldProps {
  id: keyof ProfileFields
  label: string
  value: string
  onChange: (value: string) => void
  disabled: boolean
  type?: 'text' | 'password'
  autoComplete: string
  maxLength?: number
  error?: string
  fieldProps: {
    'aria-invalid': boolean | undefined
    'aria-describedby': string | undefined
  }
}

function ProfileField({
  id,
  label,
  value,
  onChange,
  disabled,
  type = 'text',
  autoComplete,
  maxLength,
  error,
  fieldProps,
}: ProfileFieldProps) {
  return (
    <div className="profile-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        autoComplete={autoComplete}
        maxLength={maxLength}
        {...fieldProps}
      />
      {error ? (
        <p className="field-error profile-field-error" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  )
}
