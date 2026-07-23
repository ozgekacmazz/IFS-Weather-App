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
  updateDefaultCity,
  type UserProfile,
} from '../api/profileApi'
import {
  getCurrentWeather,
  getWeeklyForecast,
  type CurrentWeather,
  type WeatherForecast,
} from '../api/weatherApi'
import { useAuth } from '../auth/useAuth'
import { TemperatureChart } from '../components/TemperatureChart'
import { UserAppHeader } from '../components/UserAppHeader'
import { WeatherConditionIcon } from '../components/WeatherConditionIcon'

const weatherFailureMessage =
  'Weather information is temporarily unavailable. Please try again.'

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${value}T00:00:00Z`))
}

function formatTemperature(value: number) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
  }).format(value)
}

export function UserWeatherDashboardPage() {
  const { apiClient, logout } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [currentWeather, setCurrentWeather] =
    useState<CurrentWeather | null>(null)
  const [forecast, setForecast] = useState<WeatherForecast | null>(null)
  const [cityInput, setCityInput] = useState('')
  const [cityError, setCityError] = useState<string | null>(null)
  const [currentError, setCurrentError] = useState<string | null>(null)
  const [forecastError, setForecastError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isWeatherLoading, setIsWeatherLoading] = useState(false)
  const [isSavingCity, setIsSavingCity] = useState(false)
  const dashboardRequestSequence = useRef(0)
  const weatherRequestSequence = useRef(0)
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

  const loadWeather = useCallback(
    async () => {
      const requestId = ++weatherRequestSequence.current
      setIsWeatherLoading(true)
      setCurrentError(null)
      setForecastError(null)

      const [currentResult, forecastResult] = await Promise.allSettled([
        getCurrentWeather(apiClient),
        getWeeklyForecast(apiClient),
      ])

      if (
        !isMounted.current ||
        weatherRequestSequence.current !== requestId
      ) {
        return { currentSucceeded: false, forecastSucceeded: false }
      }

      let currentSucceeded = false
      let forecastSucceeded = false

      if (currentResult.status === 'fulfilled') {
        setCurrentWeather(currentResult.value)
        currentSucceeded = true
      } else {
        setCurrentWeather(null)
        if (!handleUnauthorized(currentResult.reason)) {
          setCurrentError(
            currentResult.reason instanceof ApiError &&
              currentResult.reason.status === 404
              ? 'No current weather record is available for this city.'
              : weatherFailureMessage,
          )
        }
      }

      if (forecastResult.status === 'fulfilled') {
        setForecast(forecastResult.value)
        forecastSucceeded = true
      } else {
        setForecast(null)
        if (!handleUnauthorized(forecastResult.reason)) {
          setForecastError(weatherFailureMessage)
        }
      }

      setIsWeatherLoading(false)
      return { currentSucceeded, forecastSucceeded }
    },
    [apiClient, handleUnauthorized],
  )

  const loadDashboard = useCallback(async () => {
    const requestId = ++dashboardRequestSequence.current
    const mutationVersion = confirmedMutationVersion.current
    setIsInitialLoading(true)
    setFeedback(null)
    setCurrentWeather(null)
    setForecast(null)

    try {
      const loadedProfile = await getProfile(apiClient)

      if (
        !isMounted.current ||
        dashboardRequestSequence.current !== requestId ||
        confirmedMutationVersion.current !== mutationVersion
      ) {
        return
      }

      setProfile(loadedProfile)
      setCityInput(loadedProfile.defaultCity ?? '')

      if (loadedProfile.defaultCity) {
        await loadWeather()
      }
    } catch (error: unknown) {
      if (
        isMounted.current &&
        dashboardRequestSequence.current === requestId &&
        confirmedMutationVersion.current === mutationVersion &&
        !handleUnauthorized(error)
      ) {
        setFeedback(
          'Your dashboard could not be loaded. Please try again.',
        )
      }
    } finally {
      if (
        isMounted.current &&
        dashboardRequestSequence.current === requestId &&
        confirmedMutationVersion.current === mutationVersion
      ) {
        setIsInitialLoading(false)
      }
    }
  }, [apiClient, handleUnauthorized, loadWeather])

  useEffect(() => {
    isMounted.current = true
    const timeoutId = window.setTimeout(() => {
      void loadDashboard()
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
      isMounted.current = false
      dashboardRequestSequence.current += 1
      weatherRequestSequence.current += 1
      mutationSequence.current += 1
    }
  }, [loadDashboard])

  async function handleCitySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (submissionInProgress.current || !profile) {
      return
    }

    const normalizedCity = cityInput.trim()

    if (normalizedCity.length === 0) {
      setCityError('City is required.')
      return
    }

    if (normalizedCity.length > 100) {
      setCityError('City must contain no more than 100 characters.')
      return
    }

    submissionInProgress.current = true
    setIsSavingCity(true)
    setCityError(null)
    setFeedback(null)
    const mutationId = ++mutationSequence.current
    dashboardRequestSequence.current += 1
    weatherRequestSequence.current += 1
    setIsWeatherLoading(false)

    try {
      const updatedProfile = await updateDefaultCity(
        apiClient,
        profile,
        normalizedCity,
      )

      if (
        !isMounted.current ||
        mutationSequence.current !== mutationId
      ) {
        return
      }

      confirmedMutationVersion.current += 1
      setIsInitialLoading(false)
      setProfile(updatedProfile)
      setCityInput(updatedProfile.defaultCity ?? '')
      setFeedback('Default city saved. Refreshing weather information.')
      setCurrentWeather(null)
      setForecast(null)
      const refreshResult = await loadWeather()

      if (
        isMounted.current &&
        mutationSequence.current === mutationId
      ) {
        setFeedback(
          refreshResult.currentSucceeded && refreshResult.forecastSucceeded
            ? 'Default city updated and weather information refreshed.'
            : 'Default city updated, but some weather information could not be refreshed.',
        )
      }
    } catch (error: unknown) {
      if (
        isMounted.current &&
        mutationSequence.current === mutationId &&
        !handleUnauthorized(error)
      ) {
        setFeedback(
          'The default city could not be updated. Please try again.',
        )
      }
    } finally {
      submissionInProgress.current = false

      if (isMounted.current) {
        setIsSavingCity(false)
      }
    }
  }

  return (
    <div className="weather-dashboard">
      <UserAppHeader onSignOut={logout} />

      <main className="dashboard-content">
        <section className="dashboard-intro">
          <div>
            <p className="eyebrow">Weather workspace</p>
            <h1>Your weather, at a glance.</h1>
            <p>
              Current conditions and the available forecast for your default
              city.
            </p>
          </div>

          <form className="city-form" onSubmit={handleCitySubmit} noValidate>
            <label htmlFor="dashboard-city">Default city</label>
            <div className="city-control">
              <input
                id="dashboard-city"
                value={cityInput}
                onChange={(event) => {
                  setCityInput(event.target.value)
                  setCityError(null)
                }}
                disabled={isSavingCity || isInitialLoading}
                maxLength={101}
                aria-invalid={cityError ? true : undefined}
                aria-describedby={cityError ? 'dashboard-city-error' : undefined}
              />
              <button type="submit" disabled={isSavingCity || isInitialLoading}>
                {isSavingCity ? 'Saving…' : 'Update city'}
              </button>
            </div>
            {cityError ? (
              <p className="field-error dashboard-field-error" id="dashboard-city-error">
                {cityError}
              </p>
            ) : null}
          </form>
        </section>

        <div className="dashboard-feedback" aria-live="polite">
          {feedback}
        </div>

        {isInitialLoading ? (
          <section className="dashboard-state" aria-live="polite">
            <h2>Loading your dashboard…</h2>
            <p>Retrieving your profile and weather information.</p>
          </section>
        ) : null}

        {!isInitialLoading && !profile ? (
          <section className="dashboard-state">
            <h2>Dashboard unavailable</h2>
            <p>{feedback ?? 'Your profile could not be loaded.'}</p>
            <button type="button" onClick={() => void loadDashboard()}>
              Try again
            </button>
          </section>
        ) : null}

        {!isInitialLoading && profile && !profile.defaultCity ? (
          <section className="dashboard-state">
            <h2>Choose your default city</h2>
            <p>Add a city above to load current and weekly weather information.</p>
          </section>
        ) : null}

        {!isInitialLoading && profile?.defaultCity ? (
          <>
            <section className="current-weather-section" aria-labelledby="current-weather-title">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Current weather</p>
                  <h2 id="current-weather-title">
                    {currentWeather?.cityName ?? profile.defaultCity}
                  </h2>
                </div>
                {isWeatherLoading ? <span>Loading…</span> : null}
              </div>

              {currentWeather ? (
                <article className="current-weather-card">
                  <WeatherConditionIcon condition={currentWeather.mainStatus} />
                  <div>
                    <p className="current-temperature">
                      {formatTemperature(currentWeather.temperature)}
                    </p>
                    <p className="weather-condition">{currentWeather.mainStatus}</p>
                    <time dateTime={currentWeather.weatherDate}>
                      {formatDate(currentWeather.weatherDate)}
                    </time>
                  </div>
                </article>
              ) : currentError ? (
                <div className="inline-state" role="status">
                  <p>{currentError}</p>
                  <button
                    type="button"
                    disabled={isSavingCity}
                    onClick={() => void loadDashboard()}
                  >
                    Retry
                  </button>
                </div>
              ) : null}
            </section>

            <section className="forecast-section" aria-labelledby="forecast-title">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Current week</p>
                  <h2 id="forecast-title">
                    {forecast
                      ? `Temperature trend for ${forecast.cityName}`
                      : 'Temperature trend'}
                  </h2>
                </div>
                {isWeatherLoading ? (
                  <span>Loading…</span>
                ) : forecast ? (
                  <span>
                    Week of <time dateTime={forecast.startDate}>{formatDate(forecast.startDate)}</time>
                  </span>
                ) : null}
              </div>

              {forecast && forecast.items.length > 0 ? (
                <TemperatureChart items={forecast.items} />
              ) : forecast && forecast.items.length === 0 ? (
                <div className="inline-state">
                  <p>No forecast records are available for this week.</p>
                </div>
              ) : forecastError ? (
                <div className="inline-state" role="status">
                  <p>{forecastError}</p>
                  <button
                    type="button"
                    disabled={isSavingCity}
                    onClick={() => void loadDashboard()}
                  >
                    Retry
                  </button>
                </div>
              ) : null}
            </section>
          </>
        ) : null}
      </main>
    </div>
  )
}
