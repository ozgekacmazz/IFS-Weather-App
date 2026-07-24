import type { ApiClient } from './apiClient'
import { isDateOnly } from './dateValidation'

export interface ExternalWeatherDay {
  date: string
  minimumTemperature: number
  maximumTemperature: number
  averageTemperature: number
  averageHumidity: number
  maximumWindSpeedKph: number
  precipitationProbability: number
  mainStatus: string
  iconUrl: string | null
}

export interface ExternalWeatherForecast {
  cityName: string
  country: string
  startDate: string
  days: ExternalWeatherDay[]
}

export interface ExternalWeatherLocation {
  providerLocationId: number | null
  name: string
  region: string | null
  country: string
  latitude: number
  longitude: number
  displayLabel: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function decodeDay(value: unknown): ExternalWeatherDay {
  if (!isRecord(value)) {
    throw new TypeError('Invalid external forecast day')
  }

  const {
    date,
    minimumTemperature,
    maximumTemperature,
    averageTemperature,
    averageHumidity,
    maximumWindSpeedKph,
    precipitationProbability,
    mainStatus,
    iconUrl,
  } = value

  if (
    !isDateOnly(date) ||
    typeof minimumTemperature !== 'number' ||
    !Number.isFinite(minimumTemperature) ||
    typeof maximumTemperature !== 'number' ||
    !Number.isFinite(maximumTemperature) ||
    typeof averageTemperature !== 'number' ||
    !Number.isFinite(averageTemperature) ||
    minimumTemperature > averageTemperature ||
    averageTemperature > maximumTemperature ||
    typeof averageHumidity !== 'number' ||
    !Number.isFinite(averageHumidity) ||
    averageHumidity < 0 ||
    averageHumidity > 100 ||
    typeof maximumWindSpeedKph !== 'number' ||
    !Number.isFinite(maximumWindSpeedKph) ||
    maximumWindSpeedKph < 0 ||
    maximumWindSpeedKph > 500 ||
    typeof precipitationProbability !== 'number' ||
    !Number.isFinite(precipitationProbability) ||
    precipitationProbability < 0 ||
    precipitationProbability > 100 ||
    !isNonEmptyString(mainStatus) ||
    (iconUrl !== null &&
      (typeof iconUrl !== 'string' || iconUrl.trim().length === 0))
  ) {
    throw new TypeError('Invalid external forecast day')
  }

  return {
    date,
    minimumTemperature,
    maximumTemperature,
    averageTemperature,
    averageHumidity,
    maximumWindSpeedKph,
    precipitationProbability,
    mainStatus,
    iconUrl,
  }
}

export function decodeExternalWeatherForecast(
  value: unknown,
): ExternalWeatherForecast {
  if (!isRecord(value)) {
    throw new TypeError('Invalid external forecast response')
  }

  const { cityName, country, startDate, days } = value

  if (
    !isNonEmptyString(cityName) ||
    !isNonEmptyString(country) ||
    !isDateOnly(startDate) ||
    !Array.isArray(days) ||
    days.length < 1 ||
    days.length > 3
  ) {
    throw new TypeError('Invalid external forecast response')
  }

  const decodedDays = days.map(decodeDay)
  const dates = decodedDays.map((day) => day.date)

  if (
    decodedDays[0].date !== startDate ||
    new Set(dates).size !== dates.length ||
    dates.some((date, index) => index > 0 && date <= dates[index - 1])
  ) {
    throw new TypeError('Invalid external forecast response')
  }

  return { cityName, country, startDate, days: decodedDays }
}

function decodeExternalWeatherLocation(value: unknown): ExternalWeatherLocation {
  if (!isRecord(value)) {
    throw new TypeError('Invalid external weather location')
  }

  const {
    providerLocationId,
    name,
    region,
    country,
    latitude,
    longitude,
    displayLabel,
  } = value

  if (
    (providerLocationId !== null &&
      (typeof providerLocationId !== 'number' ||
        !Number.isSafeInteger(providerLocationId))) ||
    !isNonEmptyString(name) ||
    (region !== null &&
      (typeof region !== 'string' || region.trim().length === 0)) ||
    !isNonEmptyString(country) ||
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180 ||
    !isNonEmptyString(displayLabel)
  ) {
    throw new TypeError('Invalid external weather location')
  }

  return {
    providerLocationId,
    name,
    region,
    country,
    latitude,
    longitude,
    displayLabel,
  }
}

export function decodeExternalWeatherLocations(
  value: unknown,
): ExternalWeatherLocation[] {
  if (!Array.isArray(value)) {
    throw new TypeError('Invalid external weather locations response')
  }

  return value.map(decodeExternalWeatherLocation)
}

export function searchExternalWeatherLocations(
  apiClient: ApiClient,
  queryText: string,
  signal?: AbortSignal,
): Promise<ExternalWeatherLocation[]> {
  const query = new URLSearchParams({ query: queryText })

  return apiClient.request(
    `api/weather/external/locations?${query.toString()}`,
    { method: 'GET', signal },
    decodeExternalWeatherLocations,
    true,
  )
}

export function getExternalWeatherForecastByCoordinates(
  apiClient: ApiClient,
  latitude: number,
  longitude: number,
  days: 1 | 2 | 3,
  signal?: AbortSignal,
): Promise<ExternalWeatherForecast> {
  const query = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    days: days.toString(),
  })

  return apiClient.request(
    `api/weather/external/forecast/coordinates?${query.toString()}`,
    { method: 'GET', signal },
    decodeExternalWeatherForecast,
    true,
  )
}

export function getExternalWeatherForecast(
  apiClient: ApiClient,
  city: string,
  days: 1 | 2 | 3,
): Promise<ExternalWeatherForecast> {
  const query = new URLSearchParams({
    city,
    days: days.toString(),
  })

  return apiClient.request(
    `api/weather/external/forecast?${query.toString()}`,
    { method: 'GET' },
    decodeExternalWeatherForecast,
    true,
  )
}
