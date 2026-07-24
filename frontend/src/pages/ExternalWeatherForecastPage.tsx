import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { ApiError } from '../api/apiError'
import {
  getExternalWeatherForecastByCoordinates,
  searchExternalWeatherLocations,
  type ExternalWeatherForecast,
  type ExternalWeatherLocation,
} from '../api/externalWeatherApi'
import { getProfile } from '../api/profileApi'
import { useAuth } from '../auth/useAuth'
import { UserAppHeader } from '../components/UserAppHeader'
import { WeatherConditionIcon } from '../components/WeatherConditionIcon'

type ForecastDays = 1 | 2 | 3
type SearchState = 'idle' | 'loading' | 'results' | 'empty' | 'error'
interface ForecastOwner {
  locationKey: string
  latitude: number
  longitude: number
  days: ForecastDays
}

type ForecastState =
  | { status: 'idle' }
  | { status: 'loading'; owner: ForecastOwner; requestId: number }
  | {
      status: 'success'
      owner: ForecastOwner
      response: ExternalWeatherForecast
    }
  | { status: 'error'; owner: ForecastOwner; message: string }

const minimumSearchLength = 2
const searchDebounceMilliseconds = 350
const genericForecastFailure =
  'The live forecast could not be loaded. Please try again.'
const genericSearchFailure =
  'Location search failed. Please check your connection and try again.'

function forecastFailureMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return genericForecastFailure
  }

  switch (error.status) {
    case 400:
      return 'Check the selected location and forecast length, then try again.'
    case 404:
      return 'The selected location could not be found by the live weather provider.'
    case 429:
      return 'The live weather request limit has been reached. Please try again later.'
    case 500:
      return 'The live weather service is temporarily unavailable.'
    case 503:
      return 'The live weather provider is unavailable. Please try again later.'
    default:
      return genericForecastFailure
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

function locationDisplayLabel(location: ExternalWeatherLocation) {
  const uniqueParts: string[] = []

  for (const part of [location.name, location.region, location.country]) {
    const trimmedPart = part?.trim()

    if (
      trimmedPart &&
      !uniqueParts.some(
        (existingPart) =>
          existingPart.localeCompare(trimmedPart, undefined, {
            sensitivity: 'accent',
          }) === 0,
      )
    ) {
      uniqueParts.push(trimmedPart)
    }
  }

  return uniqueParts.join(', ')
}

function locationKey(
  location: ExternalWeatherLocation,
  allLocations: ExternalWeatherLocation[],
  index: number,
) {
  const hasUniqueProviderId =
    location.providerLocationId !== null &&
    allLocations.filter(
      (candidate) =>
        candidate.providerLocationId === location.providerLocationId,
    ).length === 1

  return hasUniqueProviderId
    ? `provider-${location.providerLocationId}`
    : [
        location.name,
        location.region ?? '',
        location.country,
        location.latitude,
        location.longitude,
      ].join('|')
      + `|${index}`
}

function selectedLocationKey(location: ExternalWeatherLocation) {
  return location.providerLocationId !== null
    ? `provider-${location.providerLocationId}`
    : [
        location.name,
        location.region ?? '',
        location.country,
        location.latitude,
        location.longitude,
      ].join('|')
}

function createForecastOwner(
  location: ExternalWeatherLocation,
  days: ForecastDays,
): ForecastOwner {
  return {
    locationKey: selectedLocationKey(location),
    latitude: location.latitude,
    longitude: location.longitude,
    days,
  }
}

function ownerMatches(
  owner: ForecastOwner,
  location: ExternalWeatherLocation | null,
  days: ForecastDays,
) {
  return (
    location !== null &&
    owner.locationKey === selectedLocationKey(location) &&
    owner.latitude === location.latitude &&
    owner.longitude === location.longitude &&
    owner.days === days
  )
}

export function ExternalWeatherForecastPage() {
  const { apiClient, logout } = useAuth()
  const listboxId = useId()
  const [locationText, setLocationText] = useState('')
  const [selectedLocation, setSelectedLocation] =
    useState<ExternalWeatherLocation | null>(null)
  const [locations, setLocations] = useState<ExternalWeatherLocation[]>([])
  const [searchState, setSearchState] = useState<SearchState>('idle')
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false)
  const [activeOptionIndex, setActiveOptionIndex] = useState(-1)
  const [days, setDays] = useState<ForecastDays>(3)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [forecastState, setForecastState] = useState<ForecastState>({
    status: 'idle',
  })
  const [announcement, setAnnouncement] = useState('')
  const mounted = useRef(true)
  const requestSequence = useRef(0)
  const searchSequence = useRef(0)
  const profileSequence = useRef(0)
  const activeSubmissionKeys = useRef(new Map<string, number>())
  const selectedLocationRef = useRef<ExternalWeatherLocation | null>(null)
  const daysRef = useRef<ForecastDays>(3)
  const forecastController = useRef<AbortController | null>(null)
  const locationInputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<HTMLDivElement>(null)
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null)

  const handleUnauthorized = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && error.status === 401) {
        requestSequence.current += 1
        searchSequence.current += 1
        profileSequence.current += 1
        forecastController.current?.abort()
        forecastController.current = null
        activeSubmissionKeys.current.clear()
        logout()
        return true
      }

      return false
    },
    [logout],
  )

  useEffect(() => {
    mounted.current = true
    const submissionKeys = activeSubmissionKeys.current
    const profileRequestId = ++profileSequence.current

    void getProfile(apiClient)
      .then((profile) => {
        if (
          mounted.current &&
          profileSequence.current === profileRequestId &&
          profile.defaultCity
        ) {
          setLocationText((currentText) =>
            currentText || profile.defaultCity || '',
          )
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
      searchSequence.current += 1
      profileSequence.current += 1
      forecastController.current?.abort()
      forecastController.current = null
      submissionKeys.clear()
    }
  }, [apiClient, handleUnauthorized])

  useEffect(() => {
    const normalizedQuery = locationText.trim()
    const searchRequestId = ++searchSequence.current

    if (
      selectedLocation &&
      locationText === locationDisplayLabel(selectedLocation)
    ) {
      return
    }

    if (normalizedQuery.length < minimumSearchLength) {
      return
    }

    let controller: AbortController | undefined
    const debounceTimer = window.setTimeout(() => {
      controller = new AbortController()
      setSearchState('loading')
      setIsAutocompleteOpen(true)
      setActiveOptionIndex(-1)

      void searchExternalWeatherLocations(
        apiClient,
        normalizedQuery,
        controller.signal,
      )
        .then((response) => {
          if (
            !mounted.current ||
            searchSequence.current !== searchRequestId
          ) {
            return
          }

          setLocations(response)
          setSearchState(response.length > 0 ? 'results' : 'empty')
          setIsAutocompleteOpen(true)
          setActiveOptionIndex(response.length > 0 ? 0 : -1)
        })
        .catch((error: unknown) => {
          if (
            !mounted.current ||
            searchSequence.current !== searchRequestId ||
            controller?.signal.aborted
          ) {
            return
          }

          if (!handleUnauthorized(error)) {
            setLocations([])
            setSearchState('error')
            setIsAutocompleteOpen(true)
            setActiveOptionIndex(-1)
          }
        })
    }, searchDebounceMilliseconds)

    return () => {
      window.clearTimeout(debounceTimer)
      controller?.abort()
    }
  }, [apiClient, handleUnauthorized, locationText, selectedLocation])

  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !autocompleteRef.current?.contains(event.target)
      ) {
        setIsAutocompleteOpen(false)
        setActiveOptionIndex(-1)
      }
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [])

  function chooseLocation(location: ExternalWeatherLocation) {
    const displayLabel = locationDisplayLabel(location)

    searchSequence.current += 1
    requestSequence.current += 1
    forecastController.current?.abort()
    forecastController.current = null
    activeSubmissionKeys.current.clear()
    selectedLocationRef.current = location
    setSelectedLocation(location)
    setLocationText(displayLabel)
    setValidationError(null)
    setLocations([])
    setSearchState('idle')
    setIsAutocompleteOpen(false)
    setActiveOptionIndex(-1)
    setForecastState({ status: 'idle' })
    setAnnouncement(`Selected ${displayLabel}.`)
    locationInputRef.current?.focus()
  }

  function handleLocationChange(value: string) {
    requestSequence.current += 1
    forecastController.current?.abort()
    forecastController.current = null
    activeSubmissionKeys.current.clear()
    selectedLocationRef.current = null
    setLocationText(value)
    setSelectedLocation(null)
    setValidationError(null)
    setForecastState({ status: 'idle' })
    setAnnouncement('')
    setLocations([])
    setSearchState('idle')
    setIsAutocompleteOpen(false)
    setActiveOptionIndex(-1)
  }

  function handleDaysChange(nextDays: ForecastDays) {
    requestSequence.current += 1
    forecastController.current?.abort()
    forecastController.current = null
    activeSubmissionKeys.current.clear()
    daysRef.current = nextDays
    setDays(nextDays)
    setForecastState({ status: 'idle' })
    setAnnouncement('')
  }

  function handleComboboxKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      if (isAutocompleteOpen) {
        event.preventDefault()
        setIsAutocompleteOpen(false)
        setActiveOptionIndex(-1)
      }
      return
    }

    if (searchState !== 'results' || locations.length === 0) {
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setIsAutocompleteOpen(true)
      setActiveOptionIndex((current) =>
        current < 0 ? 0 : (current + 1) % locations.length,
      )
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setIsAutocompleteOpen(true)
      setActiveOptionIndex((current) =>
        current <= 0 ? locations.length - 1 : current - 1,
      )
      return
    }

    if (
      event.key === 'Enter' &&
      isAutocompleteOpen &&
      activeOptionIndex >= 0
    ) {
      event.preventDefault()
      chooseLocation(locations[activeOptionIndex])
    }
  }

  async function loadForecast() {
    const currentLocation = selectedLocationRef.current
    const currentDays = daysRef.current

    if (!currentLocation || locationText !== locationDisplayLabel(currentLocation)) {
      setValidationError('Select a location from the suggestions.')
      setForecastState({ status: 'idle' })
      locationInputRef.current?.focus()
      return
    }

    if (currentDays !== 1 && currentDays !== 2 && currentDays !== 3) {
      setForecastState({
        status: 'error',
        owner: createForecastOwner(currentLocation, currentDays),
        message: 'Choose a forecast length from 1 to 3 days.',
      })
      return
    }

    const owner = createForecastOwner(currentLocation, currentDays)
    const submissionKey = [
      owner.locationKey,
      owner.latitude,
      owner.longitude,
      owner.days,
    ].join('|')

    if (activeSubmissionKeys.current.has(submissionKey)) {
      return
    }

    forecastController.current?.abort()
    forecastController.current = new AbortController()
    const controller = forecastController.current
    const requestId = ++requestSequence.current
    activeSubmissionKeys.current.set(submissionKey, requestId)
    setValidationError(null)
    setAnnouncement('')
    setForecastState({ status: 'loading', owner, requestId })

    try {
      const response = await getExternalWeatherForecastByCoordinates(
        apiClient,
        owner.latitude,
        owner.longitude,
        owner.days,
        controller.signal,
      )

      if (
        !mounted.current ||
        requestSequence.current !== requestId ||
        controller.signal.aborted ||
        !ownerMatches(
          owner,
          selectedLocationRef.current,
          daysRef.current,
        )
      ) {
        return
      }

      setForecastState({ status: 'success', owner, response })
      setAnnouncement(
        `Live forecast loaded for ${locationDisplayLabel(currentLocation)}.`,
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
        !controller.signal.aborted &&
        ownerMatches(
          owner,
          selectedLocationRef.current,
          daysRef.current,
        ) &&
        !handleUnauthorized(caughtError)
      ) {
        setForecastState({
          status: 'error',
          owner,
          message: forecastFailureMessage(caughtError),
        })
      }
    } finally {
      if (activeSubmissionKeys.current.get(submissionKey) === requestId) {
        activeSubmissionKeys.current.delete(submissionKey)
      }

      if (
        requestSequence.current === requestId &&
        forecastController.current === controller
      ) {
        forecastController.current = null
      }
    }
  }

  function submitForecast(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void loadForecast()
  }

  const activeOptionId =
    isAutocompleteOpen &&
    searchState === 'results' &&
    activeOptionIndex >= 0
      ? `${listboxId}-option-${activeOptionIndex}`
      : undefined
  const currentForecast =
    forecastState.status === 'success' &&
    ownerMatches(forecastState.owner, selectedLocation, days)
      ? forecastState.response
      : null
  const isForecastLoading =
    forecastState.status === 'loading' &&
    ownerMatches(forecastState.owner, selectedLocation, days)
  const currentForecastError =
    forecastState.status === 'error' &&
    ownerMatches(forecastState.owner, selectedLocation, days)
      ? forecastState.message
      : null

  return (
    <div className="weather-dashboard live-forecast-page">
      <UserAppHeader onSignOut={logout} />
      <main className="live-forecast-content">
        <header className="live-forecast-intro">
          <p className="eyebrow">Live provider forecast</p>
          <h1>Explore live weather anywhere.</h1>
          <p>
            Search for an exact location, then request a fresh 1–3 day forecast.
            These results remain separate from the stored records on your
            Weather dashboard.
          </p>
        </header>

        <form
          className="live-forecast-form"
          onSubmit={(event) => void submitForecast(event)}
          noValidate
        >
          <div
            ref={autocompleteRef}
            className="live-forecast-field live-location-combobox"
          >
            <label htmlFor="live-forecast-location">Location</label>
            <input
              ref={locationInputRef}
              id="live-forecast-location"
              name="location"
              role="combobox"
              value={locationText}
              onChange={(event) => handleLocationChange(event.target.value)}
              onFocus={() => {
                if (searchState !== 'idle') {
                  setIsAutocompleteOpen(true)
                }
              }}
              onKeyDown={handleComboboxKeyDown}
              autoComplete="off"
              maxLength={100}
              aria-autocomplete="list"
              aria-expanded={isAutocompleteOpen}
              aria-controls={listboxId}
              aria-activedescendant={activeOptionId}
              aria-invalid={validationError ? true : undefined}
              aria-describedby={
                validationError
                  ? 'live-forecast-location-help live-forecast-location-error'
                  : 'live-forecast-location-help'
              }
            />
            <span id="live-forecast-location-help">
              Type at least 2 characters, then choose an exact location.
            </span>
            {validationError ? (
              <span
                id="live-forecast-location-error"
                className="error-message"
                role="alert"
              >
                {validationError}
              </span>
            ) : null}

            {isAutocompleteOpen ? (
              <div
                id={listboxId}
                className="live-location-options"
                role={searchState === 'results' ? 'listbox' : undefined}
                aria-label="Location suggestions"
              >
                {searchState === 'loading' ? (
                  <div className="live-location-state" role="status">
                    Searching locations…
                  </div>
                ) : null}
                {searchState === 'empty' ? (
                  <div className="live-location-state">
                    No matching locations found.
                  </div>
                ) : null}
                {searchState === 'error' ? (
                  <div className="live-location-state live-location-error" role="alert">
                    {genericSearchFailure}
                  </div>
                ) : null}
                {searchState === 'results'
                  ? locations.map((location, index) => (
                      <div
                        id={`${listboxId}-option-${index}`}
                        key={locationKey(location, locations, index)}
                        className="live-location-option"
                        role="option"
                        aria-selected={index === activeOptionIndex}
                        onPointerDown={(event) => {
                          event.preventDefault()
                          chooseLocation(location)
                        }}
                        onPointerMove={() => setActiveOptionIndex(index)}
                      >
                        {locationDisplayLabel(location)}
                      </div>
                    ))
                  : null}
              </div>
            ) : null}
          </div>

          <div className="live-forecast-field">
            <label htmlFor="live-forecast-days">Forecast length</label>
            <select
              id="live-forecast-days"
              name="days"
              value={days}
              onChange={(event) =>
                handleDaysChange(Number(event.target.value) as ForecastDays)
              }
            >
              <option value={1}>1 day</option>
              <option value={2}>2 days</option>
              <option value={3}>3 days</option>
            </select>
          </div>

          <button type="submit" disabled={isForecastLoading}>
            {isForecastLoading ? 'Loading live forecast…' : 'Get live forecast'}
          </button>
        </form>

        <div className="live-forecast-announcement" aria-live="polite">
          {isForecastLoading
            ? 'Contacting the live weather provider.'
            : announcement}
        </div>

        {currentForecastError ? (
          <section className="dashboard-state live-forecast-error">
            <h2>Live forecast unavailable</h2>
            <p role="alert">{currentForecastError}</p>
            <button
              type="button"
              className="secondary-button"
              onClick={() => void loadForecast()}
            >
              Retry forecast
            </button>
          </section>
        ) : null}

        {isForecastLoading ? (
          <section className="dashboard-state" aria-live="polite">
            <h2>Loading live forecast</h2>
            <p>
              Retrieving weather for {selectedLocation
                ? locationDisplayLabel(selectedLocation)
                : ''}.
            </p>
          </section>
        ) : null}

        {!currentForecast && !currentForecastError && !isForecastLoading ? (
          <section className="dashboard-state">
            <h2>Choose a location to begin</h2>
            <p>
              {selectedLocation
                ? `Ready to retrieve weather for ${locationDisplayLabel(selectedLocation)}.`
                : 'No live forecast request is made until you select a location.'}
            </p>
          </section>
        ) : null}

        {currentForecast ? (
          <section
            className="live-forecast-results"
            aria-labelledby="live-forecast-results-title"
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">Live external data</p>
                <h2
                  ref={resultsHeadingRef}
                  id="live-forecast-results-title"
                  tabIndex={-1}
                >
                  {selectedLocation
                    ? locationDisplayLabel(selectedLocation)
                    : `${currentForecast.cityName}, ${currentForecast.country}`}
                </h2>
              </div>
              <span>
                {currentForecast.days.length} day
                {currentForecast.days.length === 1 ? '' : 's'}
              </span>
            </div>
            <p className="live-forecast-source-note">
              This forecast is fetched live and is not an authoritative stored
              weather record.
            </p>
            <ol className="live-forecast-list">
              {currentForecast.days.map((day) => (
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
                      <div>
                        <dt>Average humidity</dt>
                        <dd>{day.averageHumidity}%</dd>
                      </div>
                      <div>
                        <dt>Maximum wind</dt>
                        <dd>{day.maximumWindSpeedKph} km/h</dd>
                      </div>
                      <div>
                        <dt>Rain probability</dt>
                        <dd>{day.precipitationProbability}%</dd>
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
