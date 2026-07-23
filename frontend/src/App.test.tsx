import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { App } from './App'

const apiBaseUrl = 'https://localhost:7257'

function renderApp(initialPath = '/login') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App apiBaseUrl={apiBaseUrl} />
    </MemoryRouter>,
  )
}

describe('authentication flow', () => {
  it('submits the backend contract and enters the protected shell', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          userId: 7,
          username: 'weather.user',
          email: 'weather.user@example.test',
          role: 1,
          accessToken: 'test-access-token',
          expiresAtUtc: '2026-07-22T12:00:00Z',
        }),
        { status: 200 },
      ),
    )
    const user = userEvent.setup()
    renderApp()

    await user.type(screen.getByLabelText(/username or email/i), 'weather.user')
    await user.type(screen.getByLabelText(/^password$/i), 'test-password')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    expect(await screen.findByRole('heading', { name: 'Welcome, weather.user' })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledOnce()

    const [url, options] = fetchMock.mock.calls[0]
    expect(url.toString()).toBe('https://localhost:7257/api/auth/login')
    expect(options?.method).toBe('POST')
    expect(options?.body).toBe(
      JSON.stringify({
        usernameOrEmail: 'weather.user',
        password: 'test-password',
      }),
    )
    expect(new Headers(options?.headers).has('Authorization')).toBe(false)
  })

  it('shows one generic error and clears the password after a rejected login', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          title: 'A sensitive backend detail that must not be rendered',
          status: 401,
        }),
        { status: 401 },
      ),
    )
    const user = userEvent.setup()
    renderApp()

    await user.type(screen.getByLabelText(/username or email/i), 'unknown-user')
    const passwordInput = screen.getByLabelText(/^password$/i)
    await user.type(passwordInput, 'incorrect-password')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sign-in failed. Check your credentials and account status, then try again.',
    )
    expect(screen.queryByText(/sensitive backend detail/i)).not.toBeInTheDocument()
    expect(passwordInput).toHaveValue('')
    expect(screen.getByLabelText(/username or email/i)).toHaveValue('unknown-user')
  })

  it('rejects a malformed successful response without authenticating', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          userId: 7,
          username: 'weather.user',
          email: 'weather.user@example.test',
          role: 1,
          accessToken: 'raw-response-content',
          expiresAtUtc: 'ambiguous-local-time',
        }),
        { status: 200 },
      ),
    )
    const user = userEvent.setup()
    renderApp()

    await user.type(screen.getByLabelText(/username or email/i), 'weather.user')
    await user.type(screen.getByLabelText(/^password$/i), 'test-password')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sign-in failed. Check your credentials and account status, then try again.',
    )
    expect(screen.queryByText('raw-response-content')).not.toBeInTheDocument()
    expect(screen.queryByText(/welcome, weather\.user/i)).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /sign in to your account/i }),
    ).toBeInTheDocument()
  })

  it('redirects an anonymous visitor away from the protected route', async () => {
    renderApp('/app')

    expect(
      await screen.findByRole('heading', { name: /sign in to your account/i }),
    ).toBeInTheDocument()
  })

  it('clears the in-memory session on sign out', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          userId: 7,
          username: 'weather.user',
          email: 'weather.user@example.test',
          role: 1,
          accessToken: 'test-access-token',
          expiresAtUtc: null,
        }),
        { status: 200 },
      ),
    )
    const user = userEvent.setup()
    renderApp()

    await user.type(screen.getByLabelText(/username or email/i), 'weather.user')
    await user.type(screen.getByLabelText(/^password$/i), 'test-password')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))
    await screen.findByRole('heading', { name: 'Welcome, weather.user' })
    await user.click(screen.getByRole('button', { name: /sign out/i }))

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /sign in to your account/i }),
      ).toBeInTheDocument()
    })
  })
})
