import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './useAuth'

const apiBaseUrl = 'https://localhost:7257'
const testStart = new Date('2026-07-23T08:00:00Z')
const maximumTimerDelay = 2_147_483_647

function authenticationResponse(username: string, expiresAtUtc: string) {
  return {
    userId: 7,
    username,
    email: `${username}@example.test`,
    role: 1,
    accessToken: `test-token-${username}`,
    expiresAtUtc,
  }
}

function TestConsumer() {
  const { session, login, logout, apiClient } = useAuth()

  async function signIn(username: string) {
    await login({ usernameOrEmail: username, password: 'TestPass1' })
  }

  async function requestProfile() {
    try {
      await apiClient.request(
        'api/profile',
        { method: 'GET' },
        (value) => value,
        true,
      )
    } catch {
      const result = document.getElementById('request-result')

      if (result) {
        result.textContent = 'request rejected'
      }
    }
  }

  return (
    <>
      <output aria-label="session">{session?.username ?? 'anonymous'}</output>
      <output id="request-result" aria-label="request result" />
      <button
        type="button"
        onClick={() => signIn('first-user')}
      >
        Sign in first
      </button>
      <button
        type="button"
        onClick={() => signIn('second-user')}
      >
        Sign in second
      </button>
      <button type="button" onClick={requestProfile}>
        Request profile
      </button>
      <button type="button" onClick={logout}>
        Log out
      </button>
    </>
  )
}

function renderProvider() {
  return render(
    <AuthProvider apiBaseUrl={apiBaseUrl}>
      <TestConsumer />
    </AuthProvider>,
  )
}

function mockLoginResponses(expiries: string[]) {
  const fetchMock = vi.spyOn(globalThis, 'fetch')

  expiries.forEach((expiresAtUtc, index) => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify(
          authenticationResponse(
            index === 0 ? 'first-user' : 'second-user',
            expiresAtUtc,
          ),
        ),
        { status: 200 },
      ),
    )
  })

  return fetchMock
}

describe('AuthProvider expiry robustness', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('clears a future session when its real expiry is reached', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(testStart)
    mockLoginResponses([new Date(Date.now() + 60_000).toISOString()])
    renderProvider()

    fireEvent.click(screen.getByRole('button', { name: 'Sign in first' }))
    await act(async () => Promise.resolve())
    expect(screen.getByLabelText('session')).toHaveTextContent('first-user')

    act(() => vi.advanceTimersByTime(60_000))

    expect(screen.getByLabelText('session')).toHaveTextContent('anonymous')
  })

  it('refuses an expired token even when the expiry timer has not run', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(testStart)
    const fetchMock = mockLoginResponses([
      new Date(Date.now() + 60_000).toISOString(),
    ])
    renderProvider()

    fireEvent.click(screen.getByRole('button', { name: 'Sign in first' }))
    await act(async () => Promise.resolve())
    vi.setSystemTime(new Date(Date.now() + 60_001))

    fireEvent.click(screen.getByRole('button', { name: 'Request profile' }))
    await act(async () => Promise.resolve())

    expect(screen.getByLabelText('request result')).toHaveTextContent(
      'request rejected',
    )
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(screen.getByLabelText('session')).toHaveTextContent('anonymous')
  })

  it('does not let an older session timer clear a newer session', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(testStart)
    mockLoginResponses([
      new Date(Date.now() + 60_000).toISOString(),
      new Date(Date.now() + 300_000).toISOString(),
    ])
    renderProvider()

    fireEvent.click(screen.getByRole('button', { name: 'Sign in first' }))
    await act(async () => Promise.resolve())
    fireEvent.click(screen.getByRole('button', { name: 'Sign in second' }))
    await act(async () => Promise.resolve())

    act(() => vi.advanceTimersByTime(60_000))

    expect(screen.getByLabelText('session')).toHaveTextContent('second-user')
  })

  it('rechecks rather than clearing at the browser maximum timer delay', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(testStart)
    mockLoginResponses([
      new Date(Date.now() + maximumTimerDelay + 1_000).toISOString(),
    ])
    renderProvider()

    fireEvent.click(screen.getByRole('button', { name: 'Sign in first' }))
    await act(async () => Promise.resolve())

    act(() => vi.advanceTimersByTime(maximumTimerDelay))
    expect(screen.getByLabelText('session')).toHaveTextContent('first-user')

    act(() => vi.advanceTimersByTime(1_000))
    expect(screen.getByLabelText('session')).toHaveTextContent('anonymous')
  })

  it('keeps logout immediate and ignores the former session timer', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(testStart)
    mockLoginResponses([new Date(Date.now() + 60_000).toISOString()])
    renderProvider()

    fireEvent.click(screen.getByRole('button', { name: 'Sign in first' }))
    await act(async () => Promise.resolve())
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }))
    expect(screen.getByLabelText('session')).toHaveTextContent('anonymous')

    act(() => vi.advanceTimersByTime(60_000))
    expect(screen.getByLabelText('session')).toHaveTextContent('anonymous')
  })
})
