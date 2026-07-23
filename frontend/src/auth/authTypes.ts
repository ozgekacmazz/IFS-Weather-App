export interface LoginRequest {
  usernameOrEmail: string
  password: string
}

export interface RegisterRequest {
  firstName: string
  lastName: string
  username: string
  email: string
  password: string
  defaultCity: string | null
}

export const UserRoles = {
  User: 1,
  Admin: 2,
} as const

export type UserRole = (typeof UserRoles)[keyof typeof UserRoles]

export interface AuthenticationSession {
  userId: number
  username: string
  email: string
  role: UserRole
  accessToken: string
  expiresAtUtc: string | null
}

export function isSessionExpired(
  session: AuthenticationSession,
  now = Date.now(),
): boolean {
  if (session.expiresAtUtc === null) {
    return false
  }

  return Date.parse(session.expiresAtUtc) <= now
}
