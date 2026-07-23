import type { ApiClient } from './apiClient'
import { isDateOnly, isExplicitTimestamp } from './dateValidation'

export interface CurrentWeather {
  weatherId: number
  weatherDate: string
  cityName: string
  temperature: number
  mainStatus: string
  updatedAt: string
}

export interface WeatherForecast {
  cityName: string
  startDate: string
  requestedDays: number
  items: CurrentWeather[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function decodeCurrentWeather(value: unknown): CurrentWeather {
  if (!isRecord(value)) {
    throw new TypeError('Invalid current weather response')
  }

  const {
    weatherId,
    weatherDate,
    cityName,
    temperature,
    mainStatus,
    updatedAt,
  } = value

  if (
    typeof weatherId !== 'number' ||
    !Number.isInteger(weatherId) ||
    weatherId <= 0 ||
    !isDateOnly(weatherDate) ||
    typeof cityName !== 'string' ||
    cityName.trim().length === 0 ||
    typeof temperature !== 'number' ||
    !Number.isFinite(temperature) ||
    typeof mainStatus !== 'string' ||
    mainStatus.trim().length === 0 ||
    !isExplicitTimestamp(updatedAt)
  ) {
    throw new TypeError('Invalid current weather response')
  }

  return {
    weatherId,
    weatherDate,
    cityName,
    temperature,
    mainStatus,
    updatedAt,
  }
}

export function decodeForecast(value: unknown): WeatherForecast {
  if (!isRecord(value)) {
    throw new TypeError('Invalid forecast response')
  }

  const { cityName, startDate, requestedDays, items } = value

  if (
    typeof cityName !== 'string' ||
    cityName.trim().length === 0 ||
    !isDateOnly(startDate) ||
    typeof requestedDays !== 'number' ||
    !Number.isInteger(requestedDays) ||
    requestedDays <= 0 ||
    !Array.isArray(items)
  ) {
    throw new TypeError('Invalid forecast response')
  }

  return {
    cityName,
    startDate,
    requestedDays,
    items: items.map(decodeCurrentWeather),
  }
}

export function getCurrentWeather(apiClient: ApiClient): Promise<CurrentWeather> {
  return apiClient.request(
    'api/weather/today',
    { method: 'GET' },
    decodeCurrentWeather,
    true,
  )
}

export function getWeeklyForecast(
  apiClient: ApiClient,
): Promise<WeatherForecast> {
  return apiClient.request(
    'api/weather/forecast',
    { method: 'GET' },
    decodeForecast,
    true,
  )
}
