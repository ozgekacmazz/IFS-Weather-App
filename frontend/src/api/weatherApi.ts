import type { ApiClient } from './apiClient'
import { isDateOnly, isExplicitTimestamp } from './dateValidation'

export type WeatherRecommendationCategory =
  | 'Clothing'
  | 'Activity'
  | 'Health'
  | 'Agriculture'
  | 'Safety'
  | 'General'

export type WeatherRecommendationPriority = 'Info' | 'Warning' | 'Important'

export interface WeatherRecommendation {
  category: WeatherRecommendationCategory
  title: string
  message: string
  priority: WeatherRecommendationPriority
  iconKey: string
}

export interface CurrentWeather {
  weatherId: number
  weatherDate: string
  cityName: string
  temperature: number
  minimumTemperature: number | null
  maximumTemperature: number | null
  averageHumidity: number | null
  maximumWindSpeedKph: number | null
  precipitationProbability: number | null
  mainStatus: string
  updatedAt: string
  recommendations: WeatherRecommendation[]
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

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null ||
    (typeof value === 'number' && Number.isFinite(value))
}

const recommendationCategories = new Set<WeatherRecommendationCategory>([
  'Clothing',
  'Activity',
  'Health',
  'Agriculture',
  'Safety',
  'General',
])

const recommendationPriorities = new Set<WeatherRecommendationPriority>([
  'Info',
  'Warning',
  'Important',
])

function decodeRecommendation(value: unknown): WeatherRecommendation {
  if (!isRecord(value)) {
    throw new TypeError('Invalid weather recommendation response')
  }

  const { category, title, message, priority, iconKey } = value

  if (
    typeof category !== 'string' ||
    !recommendationCategories.has(category as WeatherRecommendationCategory) ||
    typeof title !== 'string' ||
    title.trim().length === 0 ||
    typeof message !== 'string' ||
    message.trim().length === 0 ||
    typeof priority !== 'string' ||
    !recommendationPriorities.has(priority as WeatherRecommendationPriority) ||
    typeof iconKey !== 'string' ||
    iconKey.trim().length === 0
  ) {
    throw new TypeError('Invalid weather recommendation response')
  }

  return {
    category: category as WeatherRecommendationCategory,
    title,
    message,
    priority: priority as WeatherRecommendationPriority,
    iconKey,
  }
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
    minimumTemperature,
    maximumTemperature,
    averageHumidity,
    maximumWindSpeedKph,
    precipitationProbability,
    mainStatus,
    updatedAt,
    recommendations,
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
    !isNullableFiniteNumber(minimumTemperature) ||
    !isNullableFiniteNumber(maximumTemperature) ||
    (minimumTemperature === null) !== (maximumTemperature === null) ||
    (minimumTemperature !== null &&
      (minimumTemperature < -90 ||
        maximumTemperature! > 60 ||
        minimumTemperature > maximumTemperature! ||
        temperature < minimumTemperature ||
        temperature > maximumTemperature!)) ||
    !isNullableFiniteNumber(averageHumidity) ||
    (averageHumidity !== null &&
      (averageHumidity < 0 || averageHumidity > 100)) ||
    !isNullableFiniteNumber(maximumWindSpeedKph) ||
    (maximumWindSpeedKph !== null &&
      (maximumWindSpeedKph < 0 || maximumWindSpeedKph > 500)) ||
    !isNullableFiniteNumber(precipitationProbability) ||
    (precipitationProbability !== null &&
      (precipitationProbability < 0 || precipitationProbability > 100)) ||
    typeof mainStatus !== 'string' ||
    mainStatus.trim().length === 0 ||
    !isExplicitTimestamp(updatedAt) ||
    !Array.isArray(recommendations)
  ) {
    throw new TypeError('Invalid current weather response')
  }

  return {
    weatherId,
    weatherDate,
    cityName,
    temperature,
    minimumTemperature,
    maximumTemperature,
    averageHumidity,
    maximumWindSpeedKph,
    precipitationProbability,
    mainStatus,
    updatedAt,
    recommendations: recommendations.map(decodeRecommendation),
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
