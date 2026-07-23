import type { ApiClient } from './apiClient'
import { isDateOnly } from './dateValidation'

export interface ExternalWeatherDay {
  date: string
  minimumTemperature: number
  maximumTemperature: number
  averageTemperature: number
  mainStatus: string
  iconUrl: string | null
}

export interface ExternalWeatherForecast {
  cityName: string
  country: string
  startDate: string
  days: ExternalWeatherDay[]
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
