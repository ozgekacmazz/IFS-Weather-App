import { createContext } from 'react'
import type { ApiClient } from '../api/apiClient'
import type {
  AuthenticationSession,
  LoginRequest,
  RegisterRequest,
} from './authTypes'

export interface AuthContextValue {
  session: AuthenticationSession | null
  login: (request: LoginRequest) => Promise<AuthenticationSession>
  register: (request: RegisterRequest) => Promise<AuthenticationSession>
  logout: () => void
  apiClient: ApiClient
}

export const AuthContext = createContext<AuthContextValue | null>(null)
