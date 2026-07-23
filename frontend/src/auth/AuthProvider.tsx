import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { ApiClient } from '../api/apiClient'
import { login as requestLogin } from '../api/authApi'
import { AuthContext } from './authContext'
import type { AuthenticationSession, LoginRequest } from './authTypes'

interface AuthProviderProps {
  apiBaseUrl: string
  children: ReactNode
}

export function AuthProvider({ apiBaseUrl, children }: AuthProviderProps) {
  const [session, setSession] = useState<AuthenticationSession | null>(null)
  const anonymousApiClient = useMemo(() => new ApiClient(apiBaseUrl), [apiBaseUrl])

  const login = useCallback(
    async (request: LoginRequest) => {
      const authenticatedSession = await requestLogin(anonymousApiClient, request)
      setSession(authenticatedSession)
    },
    [anonymousApiClient],
  )

  const logout = useCallback(() => {
    setSession(null)
  }, [])

  const apiClient = useMemo(
    () => new ApiClient(apiBaseUrl, () => session?.accessToken ?? null),
    [apiBaseUrl, session?.accessToken],
  )

  const value = useMemo(
    () => ({ session, login, logout, apiClient }),
    [apiClient, login, logout, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
