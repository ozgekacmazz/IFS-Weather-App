import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import {
  createAdminWeather,
  deleteAdminWeather,
  getAdminWeather,
  getAdminWeatherById,
  updateAdminWeather,
  type AdminWeatherPage,
  type AdminWeatherRecord,
} from '../api/adminWeatherApi'
import { ApiError } from '../api/apiError'
import { isDateOnly } from '../api/dateValidation'
import { useAuth } from '../auth/useAuth'
import { AdminAppHeader } from '../components/AdminAppHeader'
import { AdminLiveWeatherPanel } from '../components/AdminLiveWeatherPanel'
import { WeatherConditionIcon } from '../components/WeatherConditionIcon'

const pageSize = 20
const listFailureMessage =
  'Weather records could not be loaded. Please try again.'
const detailFailureMessage =
  'Weather details could not be loaded. Please try again.'

interface CreateFields {
  weatherDate: string
  cityName: string
  temperature: string
  minimumTemperature: string
  maximumTemperature: string
  averageHumidity: string
  maximumWindSpeedKph: string
  precipitationProbability: string
  mainStatus: string
}

type CreateErrors = Partial<Record<keyof CreateFields, string>>

const emptyCreateFields: CreateFields = {
  weatherDate: '',
  cityName: '',
  temperature: '',
  minimumTemperature: '',
  maximumTemperature: '',
  averageHumidity: '',
  maximumWindSpeedKph: '',
  precipitationProbability: '',
  mainStatus: '',
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function optionalNumber(value: string) {
  return value.trim() === '' ? null : Number(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  }).format(new Date(`${value}T00:00:00Z`))
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatTemperature(value: number) {
  return `${new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(value)} °C`
}

function containDialogFocus(
  event: KeyboardEvent,
  dialog: HTMLElement | null,
  initialTarget: HTMLElement | null,
  finalTarget: HTMLButtonElement | null,
) {
  if (event.key !== 'Tab' || !dialog || !initialTarget) {
    return false
  }

  const lastTarget =
    finalTarget &&
    !finalTarget.disabled &&
    !finalTarget.closest('[hidden], [aria-hidden="true"]')
      ? finalTarget
      : initialTarget
  const activeElement = document.activeElement

  if (lastTarget === initialTarget) {
    event.preventDefault()
    initialTarget.focus()
    return true
  }

  if (event.shiftKey && activeElement === initialTarget) {
    event.preventDefault()
    lastTarget.focus()
    return true
  }

  if (!event.shiftKey && activeElement === lastTarget) {
    event.preventDefault()
    initialTarget.focus()
    return true
  }

  if (!dialog.contains(activeElement)) {
    event.preventDefault()
    initialTarget.focus()
    return true
  }

  return false
}

function validateCreate(fields: CreateFields): CreateErrors {
  const errors: CreateErrors = {}
  const city = normalizeText(fields.cityName)
  const status = normalizeText(fields.mainStatus)

  if (!fields.weatherDate) {
    errors.weatherDate = 'Weather date is required.'
  } else if (!isDateOnly(fields.weatherDate)) {
    errors.weatherDate = 'Enter a valid calendar date.'
  }

  if (city.length < 2 || city.length > 100) {
    errors.cityName = 'City must contain between 2 and 100 characters.'
  }

  if (!fields.temperature.trim()) {
    errors.temperature = 'Temperature is required.'
  } else {
    const temperature = Number(fields.temperature)
    if (!Number.isFinite(temperature) || temperature < -90 || temperature > 60) {
      errors.temperature = 'Temperature must be between -90 and 60.'
    }
  }

  const minimumTemperature = optionalNumber(fields.minimumTemperature)
  const maximumTemperature = optionalNumber(fields.maximumTemperature)
  const temperature = Number(fields.temperature)

  if ((minimumTemperature === null) !== (maximumTemperature === null)) {
    const message = 'Minimum and maximum temperature must be supplied together.'
    errors.minimumTemperature = message
    errors.maximumTemperature = message
  } else if (minimumTemperature !== null && maximumTemperature !== null) {
    if (
      !Number.isFinite(minimumTemperature) ||
      minimumTemperature < -90 ||
      minimumTemperature > 60
    ) {
      errors.minimumTemperature =
        'Minimum temperature must be between -90 and 60.'
    }
    if (
      !Number.isFinite(maximumTemperature) ||
      maximumTemperature < -90 ||
      maximumTemperature > 60
    ) {
      errors.maximumTemperature =
        'Maximum temperature must be between -90 and 60.'
    }
    if (
      Number.isFinite(minimumTemperature) &&
      Number.isFinite(maximumTemperature) &&
      minimumTemperature > maximumTemperature
    ) {
      errors.maximumTemperature =
        'Maximum temperature must be greater than or equal to minimum temperature.'
    } else if (
      Number.isFinite(temperature) &&
      (temperature < minimumTemperature || temperature > maximumTemperature)
    ) {
      errors.temperature =
        'Temperature must be between minimum and maximum temperature.'
    }
  }

  const averageHumidity = optionalNumber(fields.averageHumidity)
  if (
    averageHumidity !== null &&
    (!Number.isFinite(averageHumidity) ||
      averageHumidity < 0 ||
      averageHumidity > 100)
  ) {
    errors.averageHumidity = 'Average humidity must be between 0 and 100.'
  }

  const maximumWindSpeedKph = optionalNumber(fields.maximumWindSpeedKph)
  if (
    maximumWindSpeedKph !== null &&
    (!Number.isFinite(maximumWindSpeedKph) ||
      maximumWindSpeedKph < 0 ||
      maximumWindSpeedKph > 500)
  ) {
    errors.maximumWindSpeedKph =
      'Maximum wind speed must be between 0 and 500.'
  }

  const precipitationProbability =
    optionalNumber(fields.precipitationProbability)
  if (
    precipitationProbability !== null &&
    (!Number.isFinite(precipitationProbability) ||
      precipitationProbability < 0 ||
      precipitationProbability > 100)
  ) {
    errors.precipitationProbability =
      'Rain probability must be between 0 and 100.'
  }

  if (status.length < 2 || status.length > 50) {
    errors.mainStatus =
      'Main status must contain between 2 and 50 characters.'
  }

  return errors
}

export function AdminWeatherPage() {
  const { apiClient, logout } = useAuth()
  const [weatherPage, setWeatherPage] = useState<AdminWeatherPage | null>(null)
  const [cityInput, setCityInput] = useState('')
  const [dateInput, setDateInput] = useState('')
  const [appliedCity, setAppliedCity] = useState('')
  const [appliedDate, setAppliedDate] = useState('')
  const [filterErrors, setFilterErrors] = useState<{
    city?: string
    date?: string
  }>({})
  const [pageNumber, setPageNumber] = useState(1)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [listInstallVersion, setListInstallVersion] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [detail, setDetail] = useState<AdminWeatherRecord | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createFields, setCreateFields] = useState(emptyCreateFields)
  const [createErrors, setCreateErrors] = useState<CreateErrors>({})
  const [createError, setCreateError] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editFields, setEditFields] = useState(emptyCreateFields)
  const [editErrors, setEditErrors] = useState<CreateErrors>({})
  const [editError, setEditError] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isMutating, setIsMutating] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const mounted = useRef(true)
  const listSequence = useRef(0)
  const detailSequence = useRef(0)
  const mutationSequence = useRef(0)
  const mutationInProgress = useRef(false)
  const pageTransitionInProgress = useRef(false)
  const focusAddAfterListInstall = useRef(false)
  const addButtonRef = useRef<HTMLButtonElement>(null)
  const createHeadingRef = useRef<HTMLHeadingElement>(null)
  const createDialogRef = useRef<HTMLElement>(null)
  const createCancelRef = useRef<HTMLButtonElement>(null)
  const editButtonRef = useRef<HTMLButtonElement>(null)
  const editHeadingRef = useRef<HTMLHeadingElement>(null)
  const editDialogRef = useRef<HTMLElement>(null)
  const editCancelRef = useRef<HTMLButtonElement>(null)
  const deleteButtonRef = useRef<HTMLButtonElement>(null)
  const deleteHeadingRef = useRef<HTMLHeadingElement>(null)
  const deleteDialogRef = useRef<HTMLElement>(null)
  const deleteCancelRef = useRef<HTMLButtonElement>(null)

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

  const loadWeather = useCallback(async () => {
    if (mutationInProgress.current) {
      return
    }

    const requestId = ++listSequence.current
    setIsLoading(true)
    setListError(null)

    try {
      const response = await getAdminWeather(apiClient, {
        pageNumber: Math.max(1, pageNumber),
        pageSize,
        city: appliedCity || undefined,
        date: appliedDate || undefined,
      })
      if (!mounted.current || listSequence.current !== requestId) {
        return
      }

      const lastValidPage = Math.max(1, response.totalPages)
      if (response.pageNumber > lastValidPage) {
        setPageNumber(lastValidPage)
        return
      }

      setWeatherPage(response)
      setListInstallVersion((current) => current + 1)
    } catch (error: unknown) {
      if (
        mounted.current &&
        listSequence.current === requestId &&
        !handleUnauthorized(error)
      ) {
        setWeatherPage(null)
        setListError(listFailureMessage)
      }
    } finally {
      if (mounted.current && listSequence.current === requestId) {
        setIsLoading(false)
        pageTransitionInProgress.current = false
      }
    }
  }, [apiClient, appliedCity, appliedDate, handleUnauthorized, pageNumber])

  useEffect(() => {
    mounted.current = true
    const timeoutId = window.setTimeout(() => void loadWeather(), 0)
    return () => {
      window.clearTimeout(timeoutId)
      mounted.current = false
      listSequence.current += 1
      detailSequence.current += 1
      mutationSequence.current += 1
    }
  }, [loadWeather, refreshVersion])

  useEffect(() => {
    if (createOpen) {
      createHeadingRef.current?.focus()
    }
  }, [createOpen])

  useEffect(() => {
    if (editOpen) {
      editHeadingRef.current?.focus()
    }
  }, [editOpen])

  useEffect(() => {
    if (deleteOpen) {
      deleteHeadingRef.current?.focus()
    }
  }, [deleteOpen])

  useEffect(() => {
    if (!focusAddAfterListInstall.current) {
      return
    }

    focusAddAfterListInstall.current = false
    addButtonRef.current?.focus()
  }, [listInstallVersion])

  useEffect(() => {
    if (!createOpen && !editOpen && !deleteOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const activeDialog = deleteOpen
        ? deleteDialogRef.current
        : editOpen
          ? editDialogRef.current
          : createDialogRef.current
      const initialTarget = deleteOpen
        ? deleteHeadingRef.current
        : editOpen
          ? editHeadingRef.current
          : createHeadingRef.current
      const finalTarget = deleteOpen
        ? deleteCancelRef.current
        : editOpen
          ? editCancelRef.current
          : createCancelRef.current

      if (containDialogFocus(event, activeDialog, initialTarget, finalTarget)) {
        return
      }

      if (event.key !== 'Escape' || mutationInProgress.current) {
        return
      }
      if (deleteOpen) {
        setDeleteOpen(false)
        setDeleteError(null)
        window.setTimeout(() => deleteButtonRef.current?.focus(), 0)
      } else if (editOpen) {
        setEditOpen(false)
        setEditError(null)
        window.setTimeout(() => editButtonRef.current?.focus(), 0)
      } else {
        setCreateOpen(false)
        setCreateError(null)
        window.setTimeout(() => addButtonRef.current?.focus(), 0)
      }
    }
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [createOpen, deleteOpen, editOpen])

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutationInProgress.current || isLoading) {
      return
    }

    const city = cityInput.trim()
    const errors: typeof filterErrors = {}
    if (city.length > 100) {
      errors.city = 'City must be 100 characters or fewer.'
    }
    if (dateInput && !isDateOnly(dateInput)) {
      errors.date = 'Enter a valid calendar date.'
    }
    setFilterErrors(errors)
    if (Object.keys(errors).length > 0) {
      return
    }

    setPageNumber(1)
    setAppliedCity(city)
    setAppliedDate(dateInput)
  }

  function clearFilters() {
    if (mutationInProgress.current || isLoading) {
      return
    }
    setCityInput('')
    setDateInput('')
    setFilterErrors({})
    setPageNumber(1)
    setAppliedCity('')
    setAppliedDate('')
  }

  async function selectWeather(weatherId: number) {
    if (mutationInProgress.current) {
      return
    }
    const requestId = ++detailSequence.current
    setDetail(null)
    setDetailError(null)
    setDeleteError(null)
    setSuccessMessage(null)
    setIsDetailLoading(true)

    try {
      const response = await getAdminWeatherById(apiClient, weatherId)
      if (mounted.current && detailSequence.current === requestId) {
        setDetail(response)
      }
    } catch (error: unknown) {
      if (
        mounted.current &&
        detailSequence.current === requestId &&
        !handleUnauthorized(error)
      ) {
        setDetailError(
          error instanceof ApiError && error.status === 404
            ? 'That weather record no longer exists.'
            : error instanceof ApiError && error.status === 403
              ? 'You are not authorized to view this weather record.'
              : detailFailureMessage,
        )
      }
    } finally {
      if (mounted.current && detailSequence.current === requestId) {
        setIsDetailLoading(false)
      }
    }
  }

  function closeDetail() {
    if (mutationInProgress.current) {
      return
    }
    detailSequence.current += 1
    setDetail(null)
    setDetailError(null)
    setIsDetailLoading(false)
    setDeleteOpen(false)
    setDeleteError(null)
    setEditOpen(false)
    setEditError(null)
  }

  function openCreate() {
    setCreateFields(emptyCreateFields)
    setCreateErrors({})
    setCreateError(null)
    setSuccessMessage(null)
    setCreateOpen(true)
  }

  function closeCreate() {
    if (mutationInProgress.current) {
      return
    }
    setCreateOpen(false)
    setCreateError(null)
    window.setTimeout(() => addButtonRef.current?.focus(), 0)
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutationInProgress.current) {
      return
    }
    const errors = validateCreate(createFields)
    setCreateErrors(errors)
    setCreateError(null)
    if (Object.keys(errors).length > 0) {
      return
    }

    mutationInProgress.current = true
    const mutationId = ++mutationSequence.current
    listSequence.current += 1
    setIsMutating(true)
    try {
      const created = await createAdminWeather(apiClient, {
        weatherDate: createFields.weatherDate,
        cityName: normalizeText(createFields.cityName),
        temperature: Number(createFields.temperature),
        minimumTemperature: optionalNumber(createFields.minimumTemperature),
        maximumTemperature: optionalNumber(createFields.maximumTemperature),
        averageHumidity: optionalNumber(createFields.averageHumidity),
        maximumWindSpeedKph: optionalNumber(createFields.maximumWindSpeedKph),
        precipitationProbability:
          optionalNumber(createFields.precipitationProbability),
        mainStatus: normalizeText(createFields.mainStatus),
      })
      if (!mounted.current || mutationSequence.current !== mutationId) {
        return
      }
      setCreateOpen(false)
      setCreateFields(emptyCreateFields)
      setSuccessMessage(
        `${created.cityName} weather record for ${formatDate(created.weatherDate)} was added.`,
      )
      setPageNumber(1)
      setRefreshVersion((current) => current + 1)
      window.setTimeout(() => addButtonRef.current?.focus(), 0)
    } catch (error: unknown) {
      if (
        mounted.current &&
        mutationSequence.current === mutationId &&
        !handleUnauthorized(error)
      ) {
        setCreateError(
          error instanceof ApiError && error.status === 409
            ? 'A weather record already exists for that city and date.'
            : error instanceof ApiError && error.status === 403
              ? 'You are not authorized to add weather records.'
              : error instanceof ApiError && error.status === 400
                ? 'The weather record could not be validated. Check the entered values.'
                : 'The weather record could not be added. Please try again.',
        )
      }
    } finally {
      mutationInProgress.current = false
      if (mounted.current && mutationSequence.current === mutationId) {
        setIsMutating(false)
      }
    }
  }

  function openEdit() {
    if (!detail) {
      return
    }
    setEditFields({
      weatherDate: detail.weatherDate,
      cityName: detail.cityName,
      temperature: String(detail.temperature),
      minimumTemperature: detail.minimumTemperature?.toString() ?? '',
      maximumTemperature: detail.maximumTemperature?.toString() ?? '',
      averageHumidity: detail.averageHumidity?.toString() ?? '',
      maximumWindSpeedKph: detail.maximumWindSpeedKph?.toString() ?? '',
      precipitationProbability:
        detail.precipitationProbability?.toString() ?? '',
      mainStatus: detail.mainStatus,
    })
    setEditErrors({})
    setEditError(null)
    setSuccessMessage(null)
    setEditOpen(true)
  }

  function closeEdit() {
    if (mutationInProgress.current) {
      return
    }
    setEditOpen(false)
    setEditError(null)
    window.setTimeout(() => editButtonRef.current?.focus(), 0)
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutationInProgress.current || !detail) {
      return
    }
    const errors = validateCreate(editFields)
    setEditErrors(errors)
    setEditError(null)
    if (Object.keys(errors).length > 0) {
      return
    }

    mutationInProgress.current = true
    const mutationId = ++mutationSequence.current
    const editedId = detail.weatherId
    listSequence.current += 1
    setIsMutating(true)
    try {
      const updated = await updateAdminWeather(apiClient, editedId, {
        weatherDate: editFields.weatherDate,
        cityName: normalizeText(editFields.cityName),
        temperature: Number(editFields.temperature),
        minimumTemperature: optionalNumber(editFields.minimumTemperature),
        maximumTemperature: optionalNumber(editFields.maximumTemperature),
        averageHumidity: optionalNumber(editFields.averageHumidity),
        maximumWindSpeedKph: optionalNumber(editFields.maximumWindSpeedKph),
        precipitationProbability:
          optionalNumber(editFields.precipitationProbability),
        mainStatus: normalizeText(editFields.mainStatus),
      })
      if (!mounted.current || mutationSequence.current !== mutationId) {
        return
      }
      setEditOpen(false)
      setDetail(updated)
      setSuccessMessage(
        `${updated.cityName} weather record for ${formatDate(updated.weatherDate)} was updated.`,
      )
      setRefreshVersion((current) => current + 1)
      window.setTimeout(() => editButtonRef.current?.focus(), 0)
    } catch (error: unknown) {
      if (
        mounted.current &&
        mutationSequence.current === mutationId &&
        !handleUnauthorized(error)
      ) {
        if (error instanceof ApiError && error.status === 404) {
          setEditOpen(false)
          setDetail(null)
          focusAddAfterListInstall.current = true
          setSuccessMessage('That weather record no longer exists. The list was refreshed.')
          setRefreshVersion((current) => current + 1)
        } else {
          setEditError(
            error instanceof ApiError && error.status === 409
              ? 'A weather record already exists for that city and date.'
              : error instanceof ApiError && error.status === 403
                ? 'You are not authorized to update weather records.'
                : error instanceof ApiError && error.status === 400
                  ? 'The weather record could not be validated. Check the entered values.'
                  : 'The weather record could not be updated. Please try again.',
          )
        }
      }
    } finally {
      mutationInProgress.current = false
      if (mounted.current && mutationSequence.current === mutationId) {
        setIsMutating(false)
      }
    }
  }

  function openDelete() {
    setDeleteError(null)
    setDeleteOpen(true)
  }

  function closeDelete() {
    if (mutationInProgress.current) {
      return
    }
    setDeleteOpen(false)
    setDeleteError(null)
    window.setTimeout(() => deleteButtonRef.current?.focus(), 0)
  }

  async function confirmDelete() {
    if (mutationInProgress.current || !detail) {
      return
    }
    mutationInProgress.current = true
    const mutationId = ++mutationSequence.current
    const deleted = detail
    listSequence.current += 1
    detailSequence.current += 1
    setIsMutating(true)
    setDeleteError(null)

    try {
      await deleteAdminWeather(apiClient, deleted.weatherId)
      if (!mounted.current || mutationSequence.current !== mutationId) {
        return
      }
      setDeleteOpen(false)
      setDetail(null)
      focusAddAfterListInstall.current = true
      setSuccessMessage(
        `${deleted.cityName} weather record for ${formatDate(deleted.weatherDate)} was deleted.`,
      )
      setRefreshVersion((current) => current + 1)
    } catch (error: unknown) {
      if (
        mounted.current &&
        mutationSequence.current === mutationId &&
        !handleUnauthorized(error)
      ) {
        if (error instanceof ApiError && error.status === 404) {
          setDeleteOpen(false)
          setDetail(null)
          focusAddAfterListInstall.current = true
          setSuccessMessage('That weather record no longer exists. The list was refreshed.')
          setRefreshVersion((current) => current + 1)
        } else {
          setDeleteError(
            error instanceof ApiError && error.status === 403
              ? 'You are not authorized to delete weather records.'
              : 'The weather record could not be deleted. Please try again.',
          )
        }
      }
    } finally {
      mutationInProgress.current = false
      if (mounted.current && mutationSequence.current === mutationId) {
        setIsMutating(false)
      }
    }
  }

  const totalPages = weatherPage?.totalPages ?? 0
  function changePage(nextPage: number) {
    if (
      pageTransitionInProgress.current ||
      nextPage < 1 ||
      (totalPages > 0 && nextPage > totalPages) ||
      isLoading ||
      isMutating
    ) {
      return
    }
    pageTransitionInProgress.current = true
    setPageNumber(nextPage)
  }

  function updateCreateField(field: keyof CreateFields, value: string) {
    setCreateFields((current) => ({ ...current, [field]: value }))
    setCreateErrors((current) => ({ ...current, [field]: undefined }))
    setCreateError(null)
  }

  function updateEditField(field: keyof CreateFields, value: string) {
    setEditFields((current) => ({ ...current, [field]: value }))
    setEditErrors((current) => ({ ...current, [field]: undefined }))
    setEditError(null)
  }

  const filtersApplied = Boolean(appliedCity || appliedDate)
  const modalOpen = createOpen || editOpen || deleteOpen

  return (
    <div className="weather-dashboard admin-weather-page" aria-busy={isMutating}>
      <div inert={modalOpen}>
        <AdminAppHeader onSignOut={logout} />
        <main className="admin-users-content">
        <header className="admin-weather-intro">
          <div>
            <p className="eyebrow">Administration</p>
            <h1>Weather management</h1>
            <p>Review, add, update, and remove authoritative weather records.</p>
          </div>
          <button ref={addButtonRef} type="button" onClick={openCreate} disabled={isMutating}>
            Add weather record
          </button>
        </header>

        <AdminLiveWeatherPanel
          onSaved={(result) => {
            setSuccessMessage(
              `${result.weather.cityName} weather for ${formatDate(result.weather.weatherDate)} was ${result.inserted ? 'saved' : 'updated'}.`,
            )
            setPageNumber(1)
            setRefreshVersion((current) => current + 1)
          }}
        />

        <form className="admin-filter-form" onSubmit={applyFilters} noValidate>
          <FilterField
            id="weather-city-filter"
            label="City"
            value={cityInput}
            onChange={(value) => {
              setCityInput(value)
              setFilterErrors((current) => ({ ...current, city: undefined }))
            }}
            maxLength={101}
            error={filterErrors.city}
            disabled={isLoading || isMutating}
          />
          <FilterField
            id="weather-date-filter"
            label="Weather date"
            type="date"
            value={dateInput}
            onChange={(value) => {
              setDateInput(value)
              setFilterErrors((current) => ({ ...current, date: undefined }))
            }}
            error={filterErrors.date}
            disabled={isLoading || isMutating}
          />
          <div className="admin-filter-actions">
            <button type="submit" disabled={isLoading || isMutating}>Apply filters</button>
            <button className="secondary-button" type="button" onClick={clearFilters} disabled={isLoading || isMutating}>
              Clear
            </button>
          </div>
        </form>

        <p className="profile-success admin-weather-success motion-reveal" aria-live="polite">
          {successMessage}
        </p>

        {isLoading ? (
          <section className="dashboard-state motion-reveal" aria-live="polite">
            <h2>Loading weather records…</h2>
            <p>Retrieving weather management data.</p>
          </section>
        ) : null}
        {!isLoading && listError ? (
          <section className="dashboard-state motion-reveal">
            <h2>Weather records unavailable</h2>
            <p role="alert">{listError}</p>
            <button type="button" onClick={() => void loadWeather()}>Try again</button>
          </section>
        ) : null}
        {!isLoading && weatherPage?.items.length === 0 ? (
          <section className="dashboard-state motion-reveal">
            <h2>{filtersApplied ? 'No matching weather records' : 'No weather records yet'}</h2>
            <p>{filtersApplied ? 'Try different city or date filters.' : 'Add a weather record to get started.'}</p>
          </section>
        ) : null}

        {!isLoading && weatherPage && weatherPage.items.length > 0 ? (
          <section className="admin-table-card motion-reveal" aria-labelledby="weather-results-title">
            <div className="section-heading">
              <h2 id="weather-results-title">Weather records</h2>
              <span>{weatherPage.totalCount} total</span>
            </div>
            <div className="admin-table-scroll">
              <table>
                <thead><tr>
                  <th scope="col">Condition</th><th scope="col">City</th>
                  <th scope="col">Date</th><th scope="col">Temperature</th>
                  <th scope="col">Created</th><th scope="col"><span className="visually-hidden">Actions</span></th>
                </tr></thead>
                <tbody>
                  {weatherPage.items.map((record) => (
                    <tr key={record.weatherId}>
                      <td><div className="admin-weather-condition"><WeatherConditionIcon condition={record.mainStatus} decorative /><span>{record.mainStatus}</span></div></td>
                      <td>{record.cityName}</td>
                      <td><time dateTime={record.weatherDate}>{formatDate(record.weatherDate)}</time></td>
                      <td>{formatTemperature(record.temperature)}</td>
                      <td><time dateTime={record.createdAt}>{formatTimestamp(record.createdAt)}</time></td>
                      <td><button className="table-action" type="button" disabled={isMutating} onClick={() => void selectWeather(record.weatherId)} aria-label={`View ${record.cityName} weather for ${record.weatherDate}`}>View</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <nav className="admin-pagination" aria-label="Weather list pagination">
              <button type="button" aria-label="Previous page" disabled={pageNumber <= 1 || isLoading || isMutating} onClick={() => changePage(pageNumber - 1)}>Previous</button>
              <span aria-live="polite">Page {weatherPage.pageNumber} of {Math.max(1, weatherPage.totalPages)}</span>
              <button type="button" aria-label="Next page" disabled={totalPages === 0 || pageNumber >= totalPages || isLoading || isMutating} onClick={() => changePage(pageNumber + 1)}>Next</button>
            </nav>
          </section>
        ) : null}

        {(isDetailLoading || detailError || detail) ? (
          <section className="admin-detail-card motion-reveal" aria-labelledby="weather-detail-title">
            <div className="section-heading">
              <h2 id="weather-detail-title">Weather record details</h2>
              <button className="secondary-button" type="button" onClick={closeDetail} disabled={isMutating}>Close details</button>
            </div>
            {isDetailLoading ? <p aria-live="polite">Loading weather details…</p> : null}
            {detailError ? <p role="alert">{detailError}</p> : null}
            {detail ? (
              <>
                <div className="admin-weather-detail-condition"><WeatherConditionIcon condition={detail.mainStatus} decorative /><strong>{detail.mainStatus}</strong></div>
                <dl className="admin-detail-grid">
                  <div><dt>Record ID</dt><dd>{detail.weatherId}</dd></div>
                  <div><dt>City</dt><dd>{detail.cityName}</dd></div>
                  <div><dt>Weather date</dt><dd>{formatDate(detail.weatherDate)}</dd></div>
                  <div><dt>Temperature</dt><dd>{formatTemperature(detail.temperature)}</dd></div>
                  {detail.minimumTemperature !== null ? <div><dt>Minimum temperature</dt><dd>{formatTemperature(detail.minimumTemperature)}</dd></div> : null}
                  {detail.maximumTemperature !== null ? <div><dt>Maximum temperature</dt><dd>{formatTemperature(detail.maximumTemperature)}</dd></div> : null}
                  {detail.averageHumidity !== null ? <div><dt>Average humidity</dt><dd>{detail.averageHumidity}%</dd></div> : null}
                  {detail.maximumWindSpeedKph !== null ? <div><dt>Maximum wind</dt><dd>{detail.maximumWindSpeedKph} km/h</dd></div> : null}
                  {detail.precipitationProbability !== null ? <div><dt>Rain probability</dt><dd>{detail.precipitationProbability}%</dd></div> : null}
                  <div><dt>Created</dt><dd>{formatTimestamp(detail.createdAt)}</dd></div>
                  <div><dt>Updated</dt><dd>{formatTimestamp(detail.updatedAt)}</dd></div>
                </dl>
                <div className="admin-status-actions">
                  <button ref={editButtonRef} type="button" onClick={openEdit} disabled={isMutating}>Edit weather record</button>
                  <button ref={deleteButtonRef} className="danger-button" type="button" onClick={openDelete} disabled={isMutating}>Delete weather record</button>
                </div>
              </>
            ) : null}
          </section>
        ) : null}
        </main>
      </div>

      {createOpen ? (
        <div className="modal-backdrop">
          <section ref={createDialogRef} className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="create-weather-title" aria-describedby="create-weather-description">
            <h2 id="create-weather-title" ref={createHeadingRef} tabIndex={-1}>Add weather record</h2>
            <p id="create-weather-description">Enter an authoritative manual weather observation.</p>
            <form onSubmit={submitCreate} noValidate>
              <CreateField id="create-weather-date" label="Weather date" type="date" value={createFields.weatherDate} onChange={(value) => updateCreateField('weatherDate', value)} error={createErrors.weatherDate} disabled={isMutating} />
              <CreateField id="create-city-name" label="City name" value={createFields.cityName} onChange={(value) => updateCreateField('cityName', value)} maxLength={101} error={createErrors.cityName} disabled={isMutating} />
              <CreateField id="create-temperature" label="Temperature (°C)" type="number" value={createFields.temperature} onChange={(value) => updateCreateField('temperature', value)} error={createErrors.temperature} disabled={isMutating} />
              <CreateField id="create-minimum-temperature" label="Minimum temperature (°C, optional)" type="number" value={createFields.minimumTemperature} onChange={(value) => updateCreateField('minimumTemperature', value)} error={createErrors.minimumTemperature} disabled={isMutating} />
              <CreateField id="create-maximum-temperature" label="Maximum temperature (°C, optional)" type="number" value={createFields.maximumTemperature} onChange={(value) => updateCreateField('maximumTemperature', value)} error={createErrors.maximumTemperature} disabled={isMutating} />
              <CreateField id="create-average-humidity" label="Average humidity (%, optional)" type="number" value={createFields.averageHumidity} onChange={(value) => updateCreateField('averageHumidity', value)} error={createErrors.averageHumidity} disabled={isMutating} />
              <CreateField id="create-maximum-wind" label="Maximum wind (km/h, optional)" type="number" value={createFields.maximumWindSpeedKph} onChange={(value) => updateCreateField('maximumWindSpeedKph', value)} error={createErrors.maximumWindSpeedKph} disabled={isMutating} />
              <CreateField id="create-rain-probability" label="Rain probability (%, optional)" type="number" value={createFields.precipitationProbability} onChange={(value) => updateCreateField('precipitationProbability', value)} error={createErrors.precipitationProbability} disabled={isMutating} />
              <CreateField id="create-main-status" label="Main status" value={createFields.mainStatus} onChange={(value) => updateCreateField('mainStatus', value)} maxLength={51} error={createErrors.mainStatus} disabled={isMutating} />
              {createError ? <p className="error-message" role="alert">{createError}</p> : null}
              <div className="modal-actions">
                <button type="submit" disabled={isMutating}>{isMutating ? 'Adding record…' : 'Add record'}</button>
                <button ref={createCancelRef} className="secondary-button" type="button" onClick={closeCreate} disabled={isMutating}>Cancel</button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {editOpen && detail ? (
        <div className="modal-backdrop">
          <section ref={editDialogRef} className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="edit-weather-title" aria-describedby="edit-weather-description">
            <h2 id="edit-weather-title" ref={editHeadingRef} tabIndex={-1}>Edit weather record</h2>
            <p id="edit-weather-description">Update this authoritative weather observation.</p>
            <form onSubmit={submitEdit} noValidate>
              <CreateField id="edit-weather-date" label="Weather date" type="date" value={editFields.weatherDate} onChange={(value) => updateEditField('weatherDate', value)} error={editErrors.weatherDate} disabled={isMutating} />
              <CreateField id="edit-city-name" label="City name" value={editFields.cityName} onChange={(value) => updateEditField('cityName', value)} maxLength={101} error={editErrors.cityName} disabled={isMutating} />
              <CreateField id="edit-temperature" label="Temperature (°C)" type="number" value={editFields.temperature} onChange={(value) => updateEditField('temperature', value)} error={editErrors.temperature} disabled={isMutating} />
              <CreateField id="edit-minimum-temperature" label="Minimum temperature (°C, optional)" type="number" value={editFields.minimumTemperature} onChange={(value) => updateEditField('minimumTemperature', value)} error={editErrors.minimumTemperature} disabled={isMutating} />
              <CreateField id="edit-maximum-temperature" label="Maximum temperature (°C, optional)" type="number" value={editFields.maximumTemperature} onChange={(value) => updateEditField('maximumTemperature', value)} error={editErrors.maximumTemperature} disabled={isMutating} />
              <CreateField id="edit-average-humidity" label="Average humidity (%, optional)" type="number" value={editFields.averageHumidity} onChange={(value) => updateEditField('averageHumidity', value)} error={editErrors.averageHumidity} disabled={isMutating} />
              <CreateField id="edit-maximum-wind" label="Maximum wind (km/h, optional)" type="number" value={editFields.maximumWindSpeedKph} onChange={(value) => updateEditField('maximumWindSpeedKph', value)} error={editErrors.maximumWindSpeedKph} disabled={isMutating} />
              <CreateField id="edit-rain-probability" label="Rain probability (%, optional)" type="number" value={editFields.precipitationProbability} onChange={(value) => updateEditField('precipitationProbability', value)} error={editErrors.precipitationProbability} disabled={isMutating} />
              <CreateField id="edit-main-status" label="Main status" value={editFields.mainStatus} onChange={(value) => updateEditField('mainStatus', value)} maxLength={51} error={editErrors.mainStatus} disabled={isMutating} />
              {editError ? <p className="error-message" role="alert">{editError}</p> : null}
              <div className="modal-actions">
                <button type="submit" disabled={isMutating}>{isMutating ? 'Updating record…' : 'Update record'}</button>
                <button ref={editCancelRef} className="secondary-button" type="button" onClick={closeEdit} disabled={isMutating}>Cancel</button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {deleteOpen && detail ? (
        <div className="modal-backdrop">
          <section ref={deleteDialogRef} className="admin-modal destructive-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-weather-title" aria-describedby="delete-weather-description">
            <h2 id="delete-weather-title" ref={deleteHeadingRef} tabIndex={-1}>Delete weather record?</h2>
            <p id="delete-weather-description">Delete {detail.cityName} weather for {formatDate(detail.weatherDate)}? This cannot be undone.</p>
            {deleteError ? <p className="error-message" role="alert">{deleteError}</p> : null}
            <div className="modal-actions">
              <button className="danger-button" type="button" onClick={() => void confirmDelete()} disabled={isMutating}>{isMutating ? 'Deleting record…' : 'Confirm deletion'}</button>
              <button ref={deleteCancelRef} className="secondary-button" type="button" onClick={closeDelete} disabled={isMutating}>Cancel</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}

interface FieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  disabled: boolean
  type?: 'text' | 'date' | 'number'
  maxLength?: number
}

function FilterField(props: FieldProps) {
  return <CreateField {...props} />
}

function CreateField({
  id,
  label,
  value,
  onChange,
  error,
  disabled,
  type = 'text',
  maxLength,
}: FieldProps) {
  return (
    <div className="admin-weather-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} maxLength={maxLength} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} />
      {error ? <p className="field-error admin-filter-error" id={`${id}-error`}>{error}</p> : null}
    </div>
  )
}
