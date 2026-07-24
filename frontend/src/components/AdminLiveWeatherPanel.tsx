import { useEffect, useRef, useState } from 'react'
import {
  previewAdminLiveWeather,
  saveAdminLiveWeather,
  type AdminWeatherPreview,
  type SaveAdminWeatherPreviewResult,
} from '../api/adminWeatherApi'
import { ApiError } from '../api/apiError'
import {
  searchExternalWeatherLocations,
  type ExternalWeatherLocation,
} from '../api/externalWeatherApi'
import { useAuth } from '../auth/useAuth'

interface AdminLiveWeatherPanelProps {
  onSaved: (result: SaveAdminWeatherPreviewResult) => void
}

function displayLabel(location: ExternalWeatherLocation) {
  const parts: string[] = []
  for (const value of [location.name, location.region, location.country]) {
    const part = value?.trim()
    if (
      part &&
      !parts.some(
        (existing) =>
          existing.localeCompare(part, undefined, { sensitivity: 'accent' }) === 0,
      )
    ) {
      parts.push(part)
    }
  }
  return parts.join(', ')
}

export function AdminLiveWeatherPanel({
  onSaved,
}: AdminLiveWeatherPanelProps) {
  const { apiClient, logout } = useAuth()
  const [query, setQuery] = useState('')
  const [locations, setLocations] = useState<ExternalWeatherLocation[]>([])
  const [searchedQuery, setSearchedQuery] = useState<string | null>(null)
  const [selected, setSelected] = useState<ExternalWeatherLocation | null>(null)
  const [preview, setPreview] = useState<AdminWeatherPreview | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchSequence = useRef(0)

  useEffect(() => {
    const normalized = query.trim()
    if (selected && query === displayLabel(selected)) {
      return
    }
    if (normalized.length < 2) {
      return
    }

    const requestId = ++searchSequence.current
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setIsSearching(true)
      void searchExternalWeatherLocations(apiClient, normalized, controller.signal)
        .then((result) => {
          if (searchSequence.current === requestId) {
            setLocations(result)
            setSearchedQuery(normalized)
            setError(null)
          }
        })
        .catch((caught: unknown) => {
          if (
            searchSequence.current === requestId &&
            !(caught instanceof DOMException && caught.name === 'AbortError')
          ) {
            setLocations([])
            setSearchedQuery(null)
            setError('Location search could not be completed.')
          }
        })
        .finally(() => {
          if (searchSequence.current === requestId) setIsSearching(false)
        })
    }, 350)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [apiClient, query, selected])

  function chooseLocation(location: ExternalWeatherLocation) {
    setSelected(location)
    setQuery(displayLabel(location))
    setLocations([])
    setPreview(null)
    setError(null)
  }

  async function loadPreview() {
    if (!selected) {
      setError('Select a location from the suggestions.')
      return
    }
    setIsPreviewing(true)
    setPreview(null)
    setError(null)
    try {
      setPreview(await previewAdminLiveWeather(apiClient, {
        latitude: selected.latitude,
        longitude: selected.longitude,
        cityName: selected.name,
        displayLabel: displayLabel(selected),
      }))
    } catch (caught: unknown) {
      if (caught instanceof ApiError && caught.status === 401) {
        logout()
        return
      }
      setError(
        caught instanceof ApiError && caught.status === 403
          ? 'You are not authorized to preview live weather.'
          : 'Live weather preview could not be loaded.',
      )
    } finally {
      setIsPreviewing(false)
    }
  }

  async function savePreview() {
    if (!preview) return
    setIsSaving(true)
    setError(null)
    try {
      const result = await saveAdminLiveWeather(apiClient, preview)
      onSaved(result)
      setPreview(null)
    } catch (caught: unknown) {
      if (caught instanceof ApiError && caught.status === 401) {
        logout()
        return
      }
      setError(
        caught instanceof ApiError && caught.status === 403
          ? 'You are not authorized to save weather records.'
          : caught instanceof ApiError && caught.status === 400
            ? 'The preview is no longer valid.'
            : 'The live weather record could not be saved.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="admin-table-card" aria-labelledby="live-import-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Live provider import</p>
          <h2 id="live-import-title">Preview live weather</h2>
        </div>
      </div>
      <label htmlFor="admin-live-location">Location</label>
      <input
        id="admin-live-location"
        role="combobox"
        aria-expanded={locations.length > 0}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setSelected(null)
          setPreview(null)
          setLocations([])
          setSearchedQuery(null)
          setIsSearching(false)
        }}
        autoComplete="off"
      />
      {isSearching ? <p role="status">Searching locations…</p> : null}
      {locations.length > 0 ? (
        <div role="listbox" aria-label="Admin location suggestions">
          {locations.map((location) => (
            <button
              key={`${location.providerLocationId}-${location.latitude}-${location.longitude}`}
              type="button"
              role="option"
              onClick={() => chooseLocation(location)}
            >
              {displayLabel(location)}
            </button>
          ))}
        </div>
      ) : null}
      {!isSearching &&
      !error &&
      searchedQuery !== null &&
      locations.length === 0 ? (
        <p className="admin-live-search-state motion-reveal" role="status">
          No locations found. Try a different search.
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => void loadPreview()}
        disabled={isPreviewing || isSaving}
      >
        {isPreviewing ? 'Loading preview…' : 'Preview live weather'}
      </button>

      {preview ? (
        <div className="weather-detail-grid motion-reveal">
          <h3>{preview.displayLabel}</h3>
          <p>{preview.weatherDate}</p>
          <dl className="admin-detail-grid">
            <div><dt>Daily average</dt><dd>{preview.temperature} °C</dd></div>
            <div><dt>Minimum</dt><dd>{preview.minimumTemperature} °C</dd></div>
            <div><dt>Maximum</dt><dd>{preview.maximumTemperature} °C</dd></div>
            <div><dt>Average humidity</dt><dd>{preview.averageHumidity}%</dd></div>
            <div><dt>Maximum wind</dt><dd>{preview.maximumWindSpeedKph} km/h</dd></div>
            <div><dt>Rain probability</dt><dd>{preview.precipitationProbability}%</dd></div>
            <div><dt>Condition</dt><dd>{preview.mainStatus}</dd></div>
          </dl>
          <button
            type="button"
            onClick={() => void savePreview()}
            disabled={isSaving}
          >
            {isSaving ? 'Saving…' : 'Save preview to Today'}
          </button>
        </div>
      ) : null}
      {error ? <p className="motion-reveal" role="alert">{error}</p> : null}
    </section>
  )
}
