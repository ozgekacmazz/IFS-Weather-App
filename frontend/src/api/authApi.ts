import { ApiClient } from './apiClient'
import type { AuthenticationSession, LoginRequest, UserRole } from '../auth/authTypes'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isUserRole(value: unknown): value is UserRole {
  return value === 1 || value === 2
}

function isExplicitTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) &&
    !Number.isNaN(Date.parse(value))
  )
}

function decodeAuthenticationSession(value: unknown): AuthenticationSession {
  if (!isRecord(value)) {
    throw new TypeError('Invalid authentication response')
  }

  const { userId, username, email, role, accessToken, expiresAtUtc } = value

  if (
    typeof userId !== 'number' ||
    !Number.isInteger(userId) ||
    userId <= 0 ||
    typeof username !== 'string' ||
    username.trim().length === 0 ||
    typeof email !== 'string' ||
    email.trim().length === 0 ||
    !isUserRole(role) ||
    typeof accessToken !== 'string' ||
    accessToken.trim().length === 0 ||
    (expiresAtUtc !== null && !isExplicitTimestamp(expiresAtUtc))
  ) {
    throw new TypeError('Invalid authentication response')
  }

  return { userId, username, email, role, accessToken, expiresAtUtc }
}

export function login(
  apiClient: ApiClient,
  request: LoginRequest,
): Promise<AuthenticationSession> {
  return apiClient.request(
    'api/auth/login',
    {
      method: 'POST',
      body: JSON.stringify(request),
    },
    decodeAuthenticationSession,
  )
}
