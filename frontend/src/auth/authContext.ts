import { createContext } from 'react'
import type { ApiClient } from '../api/apiClient'
import type { AuthenticationSession, LoginRequest } from './authTypes'

export interface AuthContextValue {
  session: AuthenticationSession | null
  login: (request: LoginRequest) => Promise<void>
  logout: () => void
  apiClient: ApiClient
}

export const AuthContext = createContext<AuthContextValue | null>(null)
