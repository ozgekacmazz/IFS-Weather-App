import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { ApiError } from '../api/apiError'
import {
  getExternalWeatherForecast,
  type ExternalWeatherForecast,
} from '../api/externalWeatherApi'
import { getProfile } from '../api/profileApi'
import { useAuth } from '../auth/useAuth'
import { UserAppHeader } from '../components/UserAppHeader'
import { WeatherConditionIcon } from '../components/WeatherConditionIcon'

type ForecastDays = 1 | 2 | 3

const genericFailure =
  'The live forecast could not be loaded. Please try again.'

function cityError(city: string): string | null {
  const normalizedCity = city.trim()

  if (!normalizedCity) {
    return 'City is required.'
  }

  if (normalizedCity.length < 2) {
    return 'City must contain at least 2 characters.'
  }

  if (normalizedCity.length > 100) {
    return 'City must be 100 characters or fewer.'
  }

  return null
}

function failureMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return genericFailure
  }

  switch (error.status) {
    case 400:
      return 'Check the city and forecast length, then try again.'
    case 404:
      return 'That city could not be found by the live weather provider.'
    case 429:
      return 'The live weather request limit has been reached. Please try again later.'
    case 500:
      return 'The live weather service is temporarily unavailable.'
    case 503:
      return 'The live weather provider is unavailable. Please try again later.'
    default:
      return genericFailure
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${value}T00:00:00`))
}

function formatTemperature(value: number) {
  return `${new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
  }).format(value)} °C`
}

export function ExternalWeatherForecastPage() {
  const { apiClient, logout } = useAuth()
  const [city, setCity] = useState('')
  const [days, setDays] = useState<ForecastDays>(3)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [result, setResult] = useState<ExternalWeatherForecast | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const mounted = useRef(true)
  const requestSequence = useRef(0)
  const profileSequence = useRef(0)
  const activeSubmissionKeys = useRef(new Set<string>())
  const cityInputRef = useRef<HTMLInputElement>(null)
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null)

  const handleUnauthorized = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && error.status === 401) {
        requestSequence.current += 1
        profileSequence.current += 1
        logout()
        return true
      }

      return false
    },
    [logout],
  )

  useEffect(() => {
    mounted.current = true
    const profileRequestId = ++profileSequence.current

    void getProfile(apiClient)
      .then((profile) => {
        if (
          mounted.current &&
          profileSequence.current === profileRequestId &&
          profile.defaultCity
        ) {
          setCity((currentCity) => currentCity || profile.defaultCity || '')
        }
      })
      .catch((error: unknown) => {
        if (
          mounted.current &&
          profileSequence.current === profileRequestId
        ) {
          handleUnauthorized(error)
        }
      })

    return () => {
      mounted.current = false
      requestSequence.current += 1
      profileSequence.current += 1
    }
  }, [apiClient, handleUnauthorized])

  async function submitForecast(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalizedCity = city.trim()
    const error = cityError(city)

    if (error) {
      setValidationError(error)
      setRequestError(null)
      cityInputRef.current?.focus()
      return
    }

    if (days !== 1 && days !== 2 && days !== 3) {
      setRequestError('Choose a forecast length from 1 to 3 days.')
      return
    }

    const submissionKey = `${normalizedCity}\u0000${days}`

    if (activeSubmissionKeys.current.has(submissionKey)) {
      return
    }

    activeSubmissionKeys.current.add(submissionKey)
    const requestId = ++requestSequence.current
    setValidationError(null)
    setRequestError(null)
    setAnnouncement('')
    setIsLoading(true)

    try {
      const response = await getExternalWeatherForecast(
        apiClient,
        normalizedCity,
        days,
      )

      if (!mounted.current || requestSequence.current !== requestId) {
        return
      }

      setCity(normalizedCity)
      setResult(response)
      setAnnouncement(
        `Live forecast loaded for ${response.cityName}, ${response.country}.`,
      )
      window.setTimeout(() => {
        if (mounted.current && requestSequence.current === requestId) {
          resultsHeadingRef.current?.focus()
        }
      }, 0)
    } catch (caughtError) {
      if (
        mounted.current &&
        requestSequence.current === requestId &&
        !handleUnauthorized(caughtError)
      ) {
        setRequestError(failureMessage(caughtError))
      }
    } finally {
      activeSubmissionKeys.current.delete(submissionKey)

      if (mounted.current && requestSequence.current === requestId) {
        setIsLoading(false)
      }
    }
  }

  return (
    <div className="weather-dashboard live-forecast-page">
      <UserAppHeader onSignOut={logout} />
      <main className="live-forecast-content">
        <header className="live-forecast-intro">
          <p className="eyebrow">Live provider forecast</p>
          <h1>Explore live weather anywhere.</h1>
          <p>
            Request a fresh 1–3 day forecast from our server-side weather
            provider. These results are separate from the stored records on
            your Weather dashboard.
          </p>
        </header>

        <form
          className="live-forecast-form"
          onSubmit={(event) => void submitForecast(event)}
          noValidate
        >
          <div className="live-forecast-field">
            <label htmlFor="live-forecast-city">City</label>
            <input
              ref={cityInputRef}
              id="live-forecast-city"
              name="city"
              value={city}
              onChange={(event) => {
                setCity(event.target.value)
                setValidationError(null)
              }}
              autoComplete="address-level2"
              maxLength={101}
              aria-invalid={validationError ? true : undefined}
              aria-describedby={
                validationError
                  ? 'live-forecast-city-help live-forecast-city-error'
                  : 'live-forecast-city-help'
              }
            />
            <span id="live-forecast-city-help">
              Enter 2–100 characters. Your saved city may be suggested.
            </span>
            {validationError ? (
              <span
                id="live-forecast-city-error"
                className="error-message"
                role="alert"
              >
                {validationError}
              </span>
            ) : null}
          </div>

          <div className="live-forecast-field">
            <label htmlFor="live-forecast-days">Forecast length</label>
            <select
              id="live-forecast-days"
              name="days"
              value={days}
              onChange={(event) =>
                setDays(Number(event.target.value) as ForecastDays)
              }
            >
              <option value={1}>1 day</option>
              <option value={2}>2 days</option>
              <option value={3}>3 days</option>
            </select>
          </div>

          <button type="submit">
            {isLoading ? 'Loading live forecast…' : 'Get live forecast'}
          </button>
        </form>

        <div className="live-forecast-announcement" aria-live="polite">
          {isLoading ? 'Contacting the live weather provider.' : announcement}
        </div>

        {requestError ? (
          <section className="dashboard-state live-forecast-error">
            <h2>Live forecast unavailable</h2>
            <p role="alert">{requestError}</p>
          </section>
        ) : null}

        {!result && !requestError && !isLoading ? (
          <section className="dashboard-state">
            <h2>Choose a city to begin</h2>
            <p>No live provider request is made until you submit the form.</p>
          </section>
        ) : null}

        {result ? (
          <section
            className="live-forecast-results"
            aria-labelledby="live-forecast-results-title"
            aria-busy={isLoading}
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">Live external data</p>
                <h2
                  ref={resultsHeadingRef}
                  id="live-forecast-results-title"
                  tabIndex={-1}
                >
                  {result.cityName}, {result.country}
                </h2>
              </div>
              <span>
                {result.days.length} day{result.days.length === 1 ? '' : 's'}
              </span>
            </div>
            <p className="live-forecast-source-note">
              This forecast is fetched live and is not an authoritative stored
              weather record.
            </p>
            <ol className="live-forecast-list">
              {result.days.map((day) => (
                <li key={day.date}>
                  <article>
                    <div className="live-forecast-card-heading">
                      <WeatherConditionIcon
                        condition={day.mainStatus}
                        decorative
                      />
                      <div>
                        <time dateTime={day.date}>
                          {formatDate(day.date)}
                        </time>
                        <h3>{day.mainStatus}</h3>
                      </div>
                    </div>
                    <dl>
                      <div>
                        <dt>Minimum</dt>
                        <dd>{formatTemperature(day.minimumTemperature)}</dd>
                      </div>
                      <div>
                        <dt>Average</dt>
                        <dd>{formatTemperature(day.averageTemperature)}</dd>
                      </div>
                      <div>
                        <dt>Maximum</dt>
                        <dd>{formatTemperature(day.maximumTemperature)}</dd>
                      </div>
                    </dl>
                  </article>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </main>
    </div>
  )
}
