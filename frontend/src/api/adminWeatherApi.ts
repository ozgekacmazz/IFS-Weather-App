import type { ApiClient } from './apiClient'
import { isDateOnly, isExplicitTimestamp } from './dateValidation'

export interface AdminWeatherRecord {
  weatherId: number
  weatherDate: string
  cityName: string
  temperature: number
  mainStatus: string
  createdAt: string
  updatedAt: string
}

export interface AdminWeatherPage {
  items: AdminWeatherRecord[]
  pageNumber: number
  pageSize: number
  totalCount: number
  totalPages: number
}

export interface AdminWeatherQuery {
  pageNumber: number
  pageSize: number
  city?: string
  date?: string
}

export interface CreateAdminWeatherRequest {
  weatherDate: string
  cityName: string
  temperature: number
  mainStatus: string
}

export type UpdateAdminWeatherRequest = CreateAdminWeatherRequest

export interface AdminWeatherPreview {
  latitude: number
  longitude: number
  cityName: string
  displayLabel: string
  weatherDate: string
  temperature: number
  mainStatus: string
}

export interface SaveAdminWeatherPreviewResult {
  inserted: boolean
  weather: AdminWeatherRecord
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function decodeAdminWeather(value: unknown): AdminWeatherRecord {
  if (!isRecord(value)) {
    throw new TypeError('Invalid admin weather response')
  }

  const {
    weatherId,
    weatherDate,
    cityName,
    temperature,
    mainStatus,
    createdAt,
    updatedAt,
  } = value

  if (
    !isPositiveInteger(weatherId) ||
    !isDateOnly(weatherDate) ||
    !isNonEmptyString(cityName) ||
    typeof temperature !== 'number' ||
    !Number.isFinite(temperature) ||
    !isNonEmptyString(mainStatus) ||
    !isExplicitTimestamp(createdAt) ||
    !isExplicitTimestamp(updatedAt)
  ) {
    throw new TypeError('Invalid admin weather response')
  }

  return {
    weatherId,
    weatherDate,
    cityName,
    temperature,
    mainStatus,
    createdAt,
    updatedAt,
  }
}

function decodePage(value: unknown): AdminWeatherPage {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new TypeError('Invalid admin weather page')
  }

  const { pageNumber, pageSize, totalCount, totalPages } = value
  if (
    !isPositiveInteger(pageNumber) ||
    !isPositiveInteger(pageSize) ||
    !isNonNegativeInteger(totalCount) ||
    !isNonNegativeInteger(totalPages) ||
    totalPages !== Math.ceil(totalCount / pageSize) ||
    (totalCount === 0 && value.items.length !== 0) ||
    value.items.length > pageSize
  ) {
    throw new TypeError('Invalid admin weather page')
  }

  return {
    items: value.items.map(decodeAdminWeather),
    pageNumber,
    pageSize,
    totalCount,
    totalPages,
  }
}

function decodePreview(value: unknown): AdminWeatherPreview {
  if (!isRecord(value)) {
    throw new TypeError('Invalid admin weather preview')
  }
  const {
    latitude,
    longitude,
    cityName,
    displayLabel,
    weatherDate,
    temperature,
    mainStatus,
  } = value
  if (
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude) ||
    !isNonEmptyString(cityName) ||
    !isNonEmptyString(displayLabel) ||
    !isDateOnly(weatherDate) ||
    typeof temperature !== 'number' ||
    !Number.isFinite(temperature) ||
    !isNonEmptyString(mainStatus)
  ) {
    throw new TypeError('Invalid admin weather preview')
  }
  return {
    latitude,
    longitude,
    cityName,
    displayLabel,
    weatherDate,
    temperature,
    mainStatus,
  }
}

function decodeSaveResult(value: unknown): SaveAdminWeatherPreviewResult {
  if (!isRecord(value) || typeof value.inserted !== 'boolean') {
    throw new TypeError('Invalid admin weather save response')
  }
  return {
    inserted: value.inserted,
    weather: decodeAdminWeather(value.weather),
  }
}

export function getAdminWeather(
  apiClient: ApiClient,
  query: AdminWeatherQuery,
): Promise<AdminWeatherPage> {
  const params = new URLSearchParams({
    pageNumber: String(query.pageNumber),
    pageSize: String(query.pageSize),
  })
  const city = query.city?.trim()

  if (city) {
    params.set('city', city)
  }

  if (query.date && isDateOnly(query.date)) {
    params.set('date', query.date)
  }

  return apiClient.request(
    `api/admin/weather?${params.toString()}`,
    { method: 'GET' },
    decodePage,
    true,
  )
}

export function getAdminWeatherById(
  apiClient: ApiClient,
  weatherId: number,
): Promise<AdminWeatherRecord> {
  return apiClient.request(
    `api/admin/weather/${weatherId}`,
    { method: 'GET' },
    decodeAdminWeather,
    true,
  )
}

export function createAdminWeather(
  apiClient: ApiClient,
  request: CreateAdminWeatherRequest,
): Promise<AdminWeatherRecord> {
  return apiClient.request(
    'api/admin/weather',
    {
      method: 'POST',
      body: JSON.stringify(request),
    },
    decodeAdminWeather,
    true,
  )
}

export function updateAdminWeather(
  apiClient: ApiClient,
  weatherId: number,
  request: UpdateAdminWeatherRequest,
): Promise<AdminWeatherRecord> {
  return apiClient.request(
    `api/admin/weather/${weatherId}`,
    {
      method: 'PUT',
      body: JSON.stringify(request),
    },
    decodeAdminWeather,
    true,
  )
}

export function deleteAdminWeather(
  apiClient: ApiClient,
  weatherId: number,
): Promise<void> {
  return apiClient.request(
    `api/admin/weather/${weatherId}`,
    { method: 'DELETE' },
    () => undefined,
    true,
  )
}

export function previewAdminLiveWeather(
  apiClient: ApiClient,
  request: {
    latitude: number
    longitude: number
    cityName: string
    displayLabel: string
  },
): Promise<AdminWeatherPreview> {
  return apiClient.request(
    'api/admin/weather/live/preview',
    { method: 'POST', body: JSON.stringify(request) },
    decodePreview,
    true,
  )
}

export function saveAdminLiveWeather(
  apiClient: ApiClient,
  preview: AdminWeatherPreview,
): Promise<SaveAdminWeatherPreviewResult> {
  return apiClient.request(
    'api/admin/weather/live/save',
    { method: 'POST', body: JSON.stringify(preview) },
    decodeSaveResult,
    true,
  )
}
