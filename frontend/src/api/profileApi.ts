import type { ApiClient } from './apiClient'
import { UserRoles, type UserRole } from '../auth/authTypes'
import { isExplicitTimestamp } from './dateValidation'

export interface UserProfile {
  userId: number
  firstName: string
  lastName: string
  username: string
  email: string
  defaultCity: string | null
  role: UserRole
  status: number
  createdAt: string
}

export interface UpdateProfileRequest {
  firstName: string
  lastName: string
  defaultCity: string | null
  currentPassword: string | null
  newPassword: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function decodeProfile(value: unknown): UserProfile {
  if (!isRecord(value)) {
    throw new TypeError('Invalid profile response')
  }

  const {
    userId,
    firstName,
    lastName,
    username,
    email,
    defaultCity,
    role,
    status,
    createdAt,
  } = value

  if (
    typeof userId !== 'number' ||
    !Number.isInteger(userId) ||
    userId <= 0 ||
    !isNonEmptyString(firstName) ||
    !isNonEmptyString(lastName) ||
    !isNonEmptyString(username) ||
    !isNonEmptyString(email) ||
    (defaultCity !== null && !isNonEmptyString(defaultCity)) ||
    (role !== UserRoles.User && role !== UserRoles.Admin) ||
    (status !== 0 && status !== 1) ||
    !isExplicitTimestamp(createdAt)
  ) {
    throw new TypeError('Invalid profile response')
  }

  return {
    userId,
    firstName,
    lastName,
    username,
    email,
    defaultCity,
    role,
    status,
    createdAt,
  }
}

export function getProfile(apiClient: ApiClient): Promise<UserProfile> {
  return apiClient.request(
    'api/profile',
    { method: 'GET' },
    decodeProfile,
    true,
  )
}

export function updateDefaultCity(
  apiClient: ApiClient,
  profile: UserProfile,
  defaultCity: string,
): Promise<UserProfile> {
  return updateProfile(apiClient, {
    firstName: profile.firstName,
    lastName: profile.lastName,
    defaultCity,
    currentPassword: null,
    newPassword: null,
  })
}

export function updateProfile(
  apiClient: ApiClient,
  request: UpdateProfileRequest,
): Promise<UserProfile> {
  return apiClient.request(
    'api/profile',
    {
      method: 'PUT',
      body: JSON.stringify(request),
    },
    decodeProfile,
    true,
  )
}
