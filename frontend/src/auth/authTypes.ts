export interface LoginRequest {
  usernameOrEmail: string
  password: string
}

export type UserRole = 1 | 2

export interface AuthenticationSession {
  userId: number
  username: string
  email: string
  role: UserRole
  accessToken: string
  expiresAtUtc: string | null
}
