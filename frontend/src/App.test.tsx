import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { UserRoles, type UserRole } from './auth/authTypes'

const apiBaseUrl = 'https://localhost:7257'

function authenticationResponse(
  role: UserRole,
  expiresAtUtc: string | null = '2099-07-22T12:00:00Z',
) {
  return {
    userId: 7,
    username: role === UserRoles.Admin ? 'test.admin' : 'test.user',
    email: 'person@example.test',
    role,
    accessToken: 'test-access-token',
    expiresAtUtc,
  }
}

function profileResponse() {
  return {
    userId: 7,
    firstName: 'Test',
    lastName: 'User',
    username: 'test.user',
    email: 'person@example.test',
    defaultCity: 'Istanbul',
    role: 1,
    status: 1,
    createdAt: '2026-07-20T08:00:00Z',
  }
}

function dashboardResponse(url: string) {
  if (url.includes('/api/admin/users?')) {
    return {
      items: [],
      pageNumber: 1,
      pageSize: 20,
      totalCount: 0,
      totalPages: 0,
    }
  }

  if (url.includes('/api/admin/weather?')) {
    return {
      items: [],
      pageNumber: 1,
      pageSize: 20,
      totalCount: 0,
      totalPages: 0,
    }
  }

  if (url.endsWith('/api/profile')) {
    return profileResponse()
  }

  if (url.endsWith('/api/weather/today')) {
    return {
      weatherId: 1,
      weatherDate: '2026-07-23',
      cityName: 'Istanbul',
      temperature: 24,
      mainStatus: 'Clear',
      updatedAt: '2026-07-23T08:00:00Z',
      recommendations: [],
    }
  }

  return {
    cityName: 'Istanbul',
    startDate: '2026-07-20',
    requestedDays: 7,
    items: [],
  }
}

function mockAuthenticationAndDashboard(role: UserRole) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = input.toString()
    const payload = url.endsWith('/api/auth/login')
      ? authenticationResponse(role)
      : dashboardResponse(url)

    return Promise.resolve(
      new Response(JSON.stringify(payload), { status: 200 }),
    )
  })
}

function NavigationHarness() {
  const navigate = useNavigate()

  return (
    <>
      <button type="button" onClick={() => navigate('/login')}>
        Go to login
      </button>
      <button type="button" onClick={() => navigate('/register')}>
        Go to register
      </button>
    </>
  )
}

function renderApp(initialPath = '/login', withNavigationHarness = false) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App apiBaseUrl={apiBaseUrl} />
      {withNavigationHarness ? <NavigationHarness /> : null}
    </MemoryRouter>,
  )
}

async function submitLogin(role: UserRole, initialPath = '/login') {
  mockAuthenticationAndDashboard(role)
  const user = userEvent.setup()
  renderApp(initialPath)

  await user.type(screen.getByLabelText(/username or email/i), 'test.user')
  await user.type(screen.getByLabelText(/^password$/i), 'test-password')
  await user.click(screen.getByRole('button', { name: /^sign in$/i }))

  return user
}

describe('authentication flow', () => {
  it('submits the login contract and routes a User to the weather landing page', async () => {
    const fetchMock = mockAuthenticationAndDashboard(UserRoles.User)
    const user = userEvent.setup()
    renderApp()

    await user.type(screen.getByLabelText(/username or email/i), ' test.user ')
    await user.type(screen.getByLabelText(/^password$/i), 'test-password')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    expect(
      await screen.findByRole('heading', { name: /your weather, at a glance/i }),
    ).toBeInTheDocument()
    const [url, options] = fetchMock.mock.calls[0]
    expect(url.toString()).toBe('https://localhost:7257/api/auth/login')
    expect(options?.body).toBe(
      JSON.stringify({
        usernameOrEmail: 'test.user',
        password: 'test-password',
      }),
    )
  })

  it('routes an Admin to the administration landing page', async () => {
    await submitLogin(UserRoles.Admin)

    expect(
      await screen.findByText('Your administration workspace is ready.'),
    ).toBeInTheDocument()
  })

  it('redirects an anonymous Admin users visitor to login', async () => {
    renderApp('/app/admin/users')

    expect(
      await screen.findByRole('heading', { name: /sign in to your account/i }),
    ).toBeInTheDocument()
  })

  it('returns an Admin to the exact safe requested users route after login', async () => {
    await submitLogin(UserRoles.Admin, '/app/admin/users')

    expect(
      await screen.findByRole('heading', { name: 'User management' }),
    ).toBeInTheDocument()
  })

  it('redirects anonymous Admin weather access to login', async () => {
    renderApp('/app/admin/weather')
    expect(
      await screen.findByRole('heading', { name: /sign in to your account/i }),
    ).toBeInTheDocument()
  })

  it('returns an Admin to the exact safe requested weather route after login', async () => {
    await submitLogin(UserRoles.Admin, '/app/admin/weather')
    expect(
      await screen.findByRole('heading', { name: 'Weather management' }),
    ).toBeInTheDocument()
  })

  it('rejects an arbitrary requested Admin path after login', async () => {
    await submitLogin(UserRoles.Admin, '/app/admin/not-approved')

    expect(
      await screen.findByText('Your administration workspace is ready.'),
    ).toBeInTheDocument()
  })

  it('redirects an anonymous visitor away from a protected route', async () => {
    renderApp('/app/admin')

    expect(
      await screen.findByRole('heading', { name: /sign in to your account/i }),
    ).toBeInTheDocument()
  })

  it('redirects an anonymous profile visitor to login', async () => {
    renderApp('/app/profile')

    expect(
      await screen.findByRole('heading', { name: /sign in to your account/i }),
    ).toBeInTheDocument()
  })

  it('returns a User to the safe requested profile route after login', async () => {
    await submitLogin(UserRoles.User, '/app/profile')

    expect(
      await screen.findByRole('heading', { name: 'Your profile' }),
    ).toBeInTheDocument()
  })

  it('returns a User to the exact safe live forecast route after login', async () => {
    await submitLogin(UserRoles.User, '/app/weather/live')

    expect(
      await screen.findByRole('heading', { name: /explore live weather anywhere/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Live forecast' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('redirects anonymous live forecast access to login', async () => {
    renderApp('/app/weather/live')
    expect(
      await screen.findByRole('heading', { name: /sign in to your account/i }),
    ).toBeInTheDocument()
  })

  it('redirects an Admin away from the User live forecast route', async () => {
    await submitLogin(UserRoles.Admin, '/app/weather/live')
    expect(
      await screen.findByText('Your administration workspace is ready.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Live forecast')).not.toBeInTheDocument()
  })

  it('rejects a near-match live forecast path after User login', async () => {
    await submitLogin(UserRoles.User, '/app/weather/live/elsewhere')
    expect(
      await screen.findByRole('heading', { name: /your weather, at a glance/i }),
    ).toBeInTheDocument()
  })

  it('redirects an Admin away from the User profile route', async () => {
    await submitLogin(UserRoles.Admin, '/app/profile')

    expect(
      await screen.findByText('Your administration workspace is ready.'),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Your profile' }),
    ).not.toBeInTheDocument()
  })

  it('rejects an arbitrary requested app path after User login', async () => {
    await submitLogin(UserRoles.User, '/app/not-approved')

    expect(
      await screen.findByRole('heading', { name: /your weather, at a glance/i }),
    ).toBeInTheDocument()
  })

  it('redirects a User away from an Admin-only route', async () => {
    await submitLogin(UserRoles.User, '/app/admin')

    expect(
      await screen.findByRole('heading', { name: /your weather, at a glance/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Your administration workspace is ready.'),
    ).not.toBeInTheDocument()
  })

  it('redirects a User away from Admin user management', async () => {
    await submitLogin(UserRoles.User, '/app/admin/users')

    expect(
      await screen.findByRole('heading', { name: /your weather, at a glance/i }),
    ).toBeInTheDocument()
  })

  it('redirects a User away from Admin weather management', async () => {
    await submitLogin(UserRoles.User, '/app/admin/weather')
    expect(
      await screen.findByRole('heading', { name: /your weather, at a glance/i }),
    ).toBeInTheDocument()
  })

  it('lets an Admin navigate between overview and users and sign out', async () => {
    const user = await submitLogin(UserRoles.Admin)
    expect(await screen.findByRole('link', { name: 'Overview' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await user.click(screen.getByRole('link', { name: 'Users' }))
    expect(
      await screen.findByRole('heading', { name: 'User management' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Weather' }))
    expect(
      await screen.findByRole('heading', { name: 'Weather management' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Weather' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await user.click(screen.getByRole('link', { name: 'Overview' }))
    expect(
      await screen.findByText('Your administration workspace is ready.'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(
      await screen.findByRole('heading', { name: /sign in to your account/i }),
    ).toBeInTheDocument()
  })

  it('redirects an authenticated user away from login and registration', async () => {
    mockAuthenticationAndDashboard(UserRoles.User)
    const user = userEvent.setup()
    renderApp('/login', true)

    await user.type(screen.getByLabelText(/username or email/i), 'test.user')
    await user.type(screen.getByLabelText(/^password$/i), 'test-password')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))
    await screen.findByRole('heading', { name: /your weather, at a glance/i })

    await user.click(screen.getByRole('button', { name: 'Go to login' }))
    expect(screen.queryByText(/sign in to your account/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Go to register' }))
    expect(screen.queryByText(/create your account/i)).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /your weather, at a glance/i }),
    ).toBeInTheDocument()
  })

  it('shows the non-enumerating 401 message and clears the password', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 401 }), { status: 401 }),
    )
    const user = userEvent.setup()
    renderApp()

    await user.type(screen.getByLabelText(/username or email/i), 'unknown-user')
    const passwordInput = screen.getByLabelText(/^password$/i)
    await user.type(passwordInput, 'incorrect-password')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /credentials may be incorrect, or your account may be temporarily unavailable/i,
    )
    expect(passwordInput).toHaveValue('')
  })

  it('shows a configuration-focused network error and preserves the login password', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    renderApp('/login')
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/username or email/i), 'test-user')
    const passwordInput = screen.getByLabelText(/^password$/i)
    await user.type(passwordInput, 'test-password')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /API service could not be reached/i,
    )
    expect(passwordInput).toHaveValue('test-password')
  })

  it('prevents ordinary duplicate login submission while loading', async () => {
    let resolveRequest: ((response: Response) => void) | undefined
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveRequest = resolve
        }),
    )
    const user = userEvent.setup()
    renderApp()

    await user.type(screen.getByLabelText(/username or email/i), 'test.user')
    await user.type(screen.getByLabelText(/^password$/i), 'test-password')
    const submitButton = screen.getByRole('button', { name: /^sign in$/i })
    await user.dblClick(submitButton)

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled()

    resolveRequest?.(
      new Response(JSON.stringify(authenticationResponse(UserRoles.User)), {
        status: 200,
      }),
    )
    fetchMock.mockImplementation((input) =>
      Promise.resolve(
        new Response(JSON.stringify(dashboardResponse(input.toString())), {
          status: 200,
        }),
      ),
    )
    expect(
      await screen.findByRole('heading', { name: /your weather, at a glance/i }),
    ).toBeInTheDocument()
  })

  it('clears the in-memory session on sign out', async () => {
    const user = await submitLogin(UserRoles.User)
    await screen.findByRole('heading', { name: /your weather, at a glance/i })
    await user.click(screen.getByRole('button', { name: /sign out/i }))

    expect(
      await screen.findByRole('heading', { name: /sign in to your account/i }),
    ).toBeInTheDocument()
  })

  it('clears an already expired session before protected routing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify(
          authenticationResponse(UserRoles.User, '2020-01-01T00:00:00Z'),
        ),
        { status: 200 },
      ),
    )
    const user = userEvent.setup()
    renderApp()

    await user.type(screen.getByLabelText(/username or email/i), 'test.user')
    await user.type(screen.getByLabelText(/^password$/i), 'test-password')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /sign in to your account/i }),
      ).toBeInTheDocument()
    })
  })
})
