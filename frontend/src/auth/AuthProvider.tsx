import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { ApiClient } from '../api/apiClient'
import { login as requestLogin, register as requestRegister } from '../api/authApi'
import { AuthContext } from './authContext'
import {
  isSessionExpired,
  type AuthenticationSession,
  type LoginRequest,
  type RegisterRequest,
} from './authTypes'

interface AuthProviderProps {
  apiBaseUrl: string
  children: ReactNode
}

const maximumTimerDelay = 2_147_483_647

class InMemorySessionHolder {
  private currentSession: AuthenticationSession | null = null

  get current() {
    return this.currentSession
  }

  set(session: AuthenticationSession | null) {
    this.currentSession = session
  }

  clearIfCurrent(expectedSession: AuthenticationSession) {
    if (this.currentSession !== expectedSession) {
      return false
    }

    this.currentSession = null
    return true
  }
}

export function AuthProvider({ apiBaseUrl, children }: AuthProviderProps) {
  const [session, setSession] = useState<AuthenticationSession | null>(null)
  const [sessionHolder] = useState(() => new InMemorySessionHolder())
  const anonymousApiClient = useMemo(() => new ApiClient(apiBaseUrl), [apiBaseUrl])
  const activeSession =
    session && !isSessionExpired(session) ? session : null

  const installSession = useCallback(
    (authenticatedSession: AuthenticationSession) => {
      const usableSession = isSessionExpired(authenticatedSession)
        ? null
        : authenticatedSession

      sessionHolder.set(usableSession)
      setSession(usableSession)
      return authenticatedSession
    },
    [sessionHolder],
  )

  const clearSessionIfCurrent = useCallback(
    (expectedSession: AuthenticationSession) => {
      if (!sessionHolder.clearIfCurrent(expectedSession)) {
        return
      }

      setSession((currentSession) =>
        currentSession === expectedSession ? null : currentSession,
      )
    },
    [sessionHolder],
  )

  const login = useCallback(
    async (request: LoginRequest) => {
      const authenticatedSession = await requestLogin(anonymousApiClient, request)
      return installSession(authenticatedSession)
    },
    [anonymousApiClient, installSession],
  )

  const register = useCallback(
    async (request: RegisterRequest) => {
      const authenticatedSession = await requestRegister(anonymousApiClient, request)
      return installSession(authenticatedSession)
    },
    [anonymousApiClient, installSession],
  )

  const logout = useCallback(() => {
    sessionHolder.set(null)
    setSession(null)
  }, [sessionHolder])

  useEffect(() => {
    if (!session?.expiresAtUtc) {
      return
    }

    const scheduledSession = session
    let timeoutId: number | undefined

    const scheduleExpiryCheck = () => {
      if (sessionHolder.current !== scheduledSession) {
        return
      }

      const millisecondsUntilExpiry =
        Date.parse(scheduledSession.expiresAtUtc!) - Date.now()

      if (millisecondsUntilExpiry <= 0) {
        clearSessionIfCurrent(scheduledSession)
        return
      }

      timeoutId = window.setTimeout(
        scheduleExpiryCheck,
        Math.min(millisecondsUntilExpiry, maximumTimerDelay),
      )
    }

    scheduleExpiryCheck()

    return () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [clearSessionIfCurrent, session, sessionHolder])

  const getAccessToken = useCallback(() => {
    const currentSession = sessionHolder.current

    if (!currentSession || isSessionExpired(currentSession)) {
      if (currentSession) {
        clearSessionIfCurrent(currentSession)
      }

      return null
    }

    return currentSession.accessToken
  }, [clearSessionIfCurrent, sessionHolder])

  const apiClient = useMemo(
    () => new ApiClient(apiBaseUrl, getAccessToken),
    [apiBaseUrl, getAccessToken],
  )

  const value = useMemo(
    () => ({ session: activeSession, login, register, logout, apiClient }),
    [activeSession, apiClient, login, logout, register],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
