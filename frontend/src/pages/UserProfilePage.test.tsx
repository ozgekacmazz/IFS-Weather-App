import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { App } from '../App'

const apiBaseUrl = 'https://localhost:7257'

const authentication = {
  userId: 7,
  username: 'test.user',
  email: 'person@example.test',
  role: 1,
  accessToken: 'test-access-token',
  expiresAtUtc: '2099-07-22T12:00:00Z',
}

function profile(overrides: Record<string, unknown> = {}) {
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
    ...overrides,
  }
}

function jsonResponse(value: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(value), { status }),
  )
}

function successfulProfileFetch(input: RequestInfo | URL, init?: RequestInit) {
  if (input.toString().endsWith('/api/auth/login')) {
    return jsonResponse(authentication)
  }

  if (input.toString().endsWith('/api/profile') && init?.method === 'PUT') {
    return jsonResponse(profile())
  }

  return jsonResponse(profile())
}

async function enterProfile(
  implementation: (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => Promise<Response> = successfulProfileFetch,
) {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(
    implementation,
  )
  const user = userEvent.setup()
  const view = render(
    <MemoryRouter initialEntries={['/app/profile']}>
      <App apiBaseUrl={apiBaseUrl} />
    </MemoryRouter>,
  )

  await user.type(screen.getByLabelText(/username or email/i), 'test.user')
  await user.type(screen.getByLabelText(/^password$/i), 'TestPass1')
  await user.click(screen.getByRole('button', { name: /^sign in$/i }))
  await screen.findByRole('heading', { name: 'Your profile' })

  return { fetchMock, user, view }
}

async function loadedProfileFields() {
  const firstName = await screen.findByLabelText('First name')
  await waitFor(() => expect(firstName).toBeEnabled())
  return {
    firstName,
    lastName: screen.getByLabelText('Last name'),
    defaultCity: screen.getByLabelText('Default city (optional)'),
  }
}

describe('UserProfilePage', () => {
  it('shows intentional loading and then read-only account information', async () => {
    let resolveProfile: ((response: Response) => void) | undefined
    await enterProfile((input) => {
      if (input.toString().endsWith('/api/auth/login')) {
        return jsonResponse(authentication)
      }

      return new Promise<Response>((resolve) => {
        resolveProfile = resolve
      })
    })

    expect(screen.getByText('Loading your profile…')).toBeInTheDocument()
    await waitFor(() => expect(resolveProfile).toBeTypeOf('function'))
    resolveProfile?.(
      new Response(JSON.stringify(profile()), { status: 200 }),
    )

    expect(await screen.findByLabelText('Username')).toHaveValue('test.user')
    expect(screen.getByLabelText('Username')).toHaveAttribute('readonly')
    expect(screen.getByLabelText('Email')).toHaveValue(
      'person@example.test',
    )
    expect(screen.getByLabelText('Email')).toHaveAttribute('readonly')
  })

  it('recovers from a safe profile load failure through Retry', async () => {
    let profileRequests = 0
    const { user } = await enterProfile((input) => {
      if (input.toString().endsWith('/api/auth/login')) {
        return jsonResponse(authentication)
      }

      profileRequests += 1
      return profileRequests === 1
        ? jsonResponse({ detail: 'private backend detail' }, 503)
        : jsonResponse(profile())
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your profile could not be loaded.',
    )
    expect(screen.queryByText('private backend detail')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByLabelText('First name')).toHaveValue('Test')
    expect(profileRequests).toBe(2)
  })

  it('validates required names and their 100-character boundaries', async () => {
    const { fetchMock, user } = await enterProfile()
    const { firstName, lastName } = await loadedProfileFields()

    await user.clear(firstName)
    await user.clear(lastName)
    await user.click(screen.getByRole('button', { name: 'Save profile' }))
    expect(screen.getByText('First name is required.')).toBeInTheDocument()
    expect(screen.getByText('Last name is required.')).toBeInTheDocument()

    await user.type(firstName, 'x'.repeat(101))
    await user.type(lastName, 'y'.repeat(101))
    await user.click(screen.getByRole('button', { name: 'Save profile' }))
    expect(
      screen.getByText('First name must be 100 characters or fewer.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Last name must be 100 characters or fewer.'),
    ).toBeInTheDocument()
    expect(
      fetchMock.mock.calls.filter(([, options]) => options?.method === 'PUT'),
    ).toHaveLength(0)
  })

  it('trims profile fields, accepts 100 characters, and sends blank city as null', async () => {
    const confirmedName = 'A'.repeat(100)
    const { fetchMock, user } = await enterProfile((input, init) => {
      if (input.toString().endsWith('/api/auth/login')) {
        return jsonResponse(authentication)
      }

      if (init?.method === 'PUT') {
        return jsonResponse(profile({
          firstName: confirmedName,
          lastName: 'Lovelace',
          defaultCity: null,
        }))
      }

      return jsonResponse(profile())
    })
    const { firstName, lastName, defaultCity } = await loadedProfileFields()
    await user.clear(firstName)
    await user.type(firstName, ` ${confirmedName} `)
    await user.clear(lastName)
    await user.type(lastName, ' Lovelace ')
    await user.clear(defaultCity)
    await user.type(defaultCity, '   ')
    await user.click(screen.getByRole('button', { name: 'Save profile' }))

    expect(
      await screen.findByText('Your profile has been updated.'),
    ).toBeInTheDocument()
    const updateCall = fetchMock.mock.calls.find(
      ([, options]) => options?.method === 'PUT',
    )
    expect(JSON.parse(String(updateCall?.[1]?.body))).toEqual({
      firstName: confirmedName,
      lastName: 'Lovelace',
      defaultCity: null,
      currentPassword: null,
      newPassword: null,
    })
  })

  it('rejects a 101-character city without a request', async () => {
    const { fetchMock, user } = await enterProfile()
    const { defaultCity } = await loadedProfileFields()
    await user.clear(defaultCity)
    await user.type(defaultCity, 'x'.repeat(101))
    await user.click(screen.getByRole('button', { name: 'Save profile' }))

    expect(
      screen.getByText('Default city must be 100 characters or fewer.'),
    ).toBeInTheDocument()
    expect(
      fetchMock.mock.calls.filter(([, options]) => options?.method === 'PUT'),
    ).toHaveLength(0)
  })

  it('accepts a 100-character default city', async () => {
    const city = 'C'.repeat(100)
    const { fetchMock, user } = await enterProfile((input, init) => {
      if (input.toString().endsWith('/api/auth/login')) {
        return jsonResponse(authentication)
      }

      return init?.method === 'PUT'
        ? jsonResponse(profile({ defaultCity: city }))
        : jsonResponse(profile())
    })
    const { defaultCity } = await loadedProfileFields()
    await user.clear(defaultCity)
    await user.type(defaultCity, city)
    await user.click(screen.getByRole('button', { name: 'Save profile' }))

    expect(
      await screen.findByText('Your profile has been updated.'),
    ).toBeInTheDocument()
    const body = JSON.parse(
      String(fetchMock.mock.calls.find(([, options]) => options?.method === 'PUT')?.[1]?.body),
    )
    expect(body.defaultCity).toBe(city)
  })

  it('requires the complete password section and validates complexity and confirmation', async () => {
    const { fetchMock, user } = await enterProfile()
    await loadedProfileFields()
    const currentPassword = screen.getByLabelText('Current password')
    const newPassword = screen.getByLabelText('New password')
    const confirmation = screen.getByLabelText('Confirm new password')

    await user.type(currentPassword, 'current')
    await user.click(screen.getByRole('button', { name: 'Save profile' }))
    expect(screen.getByText('New password is required.')).toBeInTheDocument()
    expect(screen.getByText('Confirm your new password.')).toBeInTheDocument()

    await user.clear(currentPassword)
    await user.type(newPassword, 'ValidPass1')
    await user.type(confirmation, 'ValidPass1')
    await user.click(screen.getByRole('button', { name: 'Save profile' }))
    expect(screen.getByText('Current password is required.')).toBeInTheDocument()

    await user.clear(newPassword)
    await user.clear(confirmation)
    await user.type(newPassword, 'weakpass')
    await user.type(confirmation, 'different')
    await user.click(screen.getByRole('button', { name: 'Save profile' }))
    expect(screen.getByText(/use at least 8 characters/i)).toBeInTheDocument()
    expect(
      screen.getByText('New password confirmation must match.'),
    ).toBeInTheDocument()
    expect(
      fetchMock.mock.calls.filter(([, options]) => options?.method === 'PUT'),
    ).toHaveLength(0)
  })

  it('preserves password whitespace, excludes confirmation, adopts the response, and clears passwords', async () => {
    const { fetchMock, user } = await enterProfile((input, init) => {
      if (input.toString().endsWith('/api/auth/login')) {
        return jsonResponse(authentication)
      }

      return init?.method === 'PUT'
        ? jsonResponse(profile({ firstName: 'Confirmed', defaultCity: 'Ankara' }))
        : jsonResponse(profile())
    })
    await loadedProfileFields()
    const currentPassword = screen.getByLabelText('Current password')
    const newPassword = screen.getByLabelText('New password')
    const confirmation = screen.getByLabelText('Confirm new password')
    await user.type(currentPassword, ' Current1 ')
    await user.type(newPassword, ' NewPass1 ')
    await user.type(confirmation, ' NewPass1 ')
    await user.click(screen.getByRole('button', { name: 'Save profile' }))

    expect(
      await screen.findByText('Your profile has been updated.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('First name')).toHaveValue('Confirmed')
    expect(screen.getByLabelText('Default city (optional)')).toHaveValue('Ankara')
    expect(currentPassword).toHaveValue('')
    expect(newPassword).toHaveValue('')
    expect(confirmation).toHaveValue('')
    const body = JSON.parse(
      String(fetchMock.mock.calls.find(([, options]) => options?.method === 'PUT')?.[1]?.body),
    )
    expect(body.currentPassword).toBe(' Current1 ')
    expect(body.newPassword).toBe(' NewPass1 ')
    expect(body).not.toHaveProperty('confirmNewPassword')
  })

  it('clears passwords and preserves confirmed profile after a safe failed update', async () => {
    const { user } = await enterProfile((input, init) => {
      if (input.toString().endsWith('/api/auth/login')) {
        return jsonResponse(authentication)
      }

      return init?.method === 'PUT'
        ? jsonResponse({ detail: 'incorrect current password' }, 400)
        : jsonResponse(profile())
    })
    const { firstName } = await loadedProfileFields()
    await user.clear(firstName)
    await user.type(firstName, 'Unconfirmed')
    await user.type(screen.getByLabelText('Current password'), 'Current1')
    await user.type(screen.getByLabelText('New password'), 'NewPass1')
    await user.type(screen.getByLabelText('Confirm new password'), 'NewPass1')
    await user.click(screen.getByRole('button', { name: 'Save profile' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your profile could not be updated.',
    )
    expect(screen.queryByText('incorrect current password')).not.toBeInTheDocument()
    expect(firstName).toHaveValue('Test')
    expect(screen.getByLabelText('Current password')).toHaveValue('')
    expect(screen.getByLabelText('New password')).toHaveValue('')
    expect(screen.getByLabelText('Confirm new password')).toHaveValue('')
  })

  it('logs out on an update 401', async () => {
    const { user } = await enterProfile((input, init) => {
      if (input.toString().endsWith('/api/auth/login')) {
        return jsonResponse(authentication)
      }

      return init?.method === 'PUT'
        ? jsonResponse({ status: 401 }, 401)
        : jsonResponse(profile())
    })
    await loadedProfileFields()
    await user.click(screen.getByRole('button', { name: 'Save profile' }))

    expect(
      await screen.findByRole('heading', { name: /sign in to your account/i }),
    ).toBeInTheDocument()
  })

  it('prevents duplicate updates while a PUT is pending and keeps Retry unavailable', async () => {
    let resolveUpdate: ((response: Response) => void) | undefined
    const { fetchMock, user } = await enterProfile((input, init) => {
      if (input.toString().endsWith('/api/auth/login')) {
        return jsonResponse(authentication)
      }

      if (init?.method === 'PUT') {
        return new Promise<Response>((resolve) => {
          resolveUpdate = resolve
        })
      }

      return jsonResponse(profile())
    })
    await loadedProfileFields()
    await user.dblClick(screen.getByRole('button', { name: 'Save profile' }))

    expect(
      fetchMock.mock.calls.filter(([, options]) => options?.method === 'PUT'),
    ).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Saving profile…' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
    resolveUpdate?.(
      new Response(JSON.stringify(profile({ firstName: 'Confirmed' })), {
        status: 200,
      }),
    )
    expect(await screen.findByLabelText('First name')).toHaveValue('Confirmed')
  })

  it('treats a malformed successful update response as a safe failure', async () => {
    const { user } = await enterProfile((input, init) => {
      if (input.toString().endsWith('/api/auth/login')) {
        return jsonResponse(authentication)
      }

      return init?.method === 'PUT'
        ? jsonResponse({ ...profile(), createdAt: 'not-a-date' })
        : jsonResponse(profile())
    })
    await loadedProfileFields()
    await user.click(screen.getByRole('button', { name: 'Save profile' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your profile could not be updated.',
    )
  })

  it('unmounts safely while GET is pending', async () => {
    let resolveProfile: ((response: Response) => void) | undefined
    const { view } = await enterProfile((input) => {
      if (input.toString().endsWith('/api/auth/login')) {
        return jsonResponse(authentication)
      }

      return new Promise<Response>((resolve) => {
        resolveProfile = resolve
      })
    })

    await waitFor(() => expect(resolveProfile).toBeTypeOf('function'))
    view.unmount()
    resolveProfile?.(
      new Response(JSON.stringify(profile()), { status: 200 }),
    )
    await Promise.resolve()
    await Promise.resolve()
  })

  it('unmounts safely while PUT is pending', async () => {
    let resolveUpdate: ((response: Response) => void) | undefined
    const { user, view } = await enterProfile((input, init) => {
      if (input.toString().endsWith('/api/auth/login')) {
        return jsonResponse(authentication)
      }

      if (init?.method === 'PUT') {
        return new Promise<Response>((resolve) => {
          resolveUpdate = resolve
        })
      }

      return jsonResponse(profile())
    })
    await loadedProfileFields()
    await user.click(screen.getByRole('button', { name: 'Save profile' }))
    await waitFor(() => expect(resolveUpdate).toBeTypeOf('function'))
    view.unmount()
    resolveUpdate?.(
      new Response(JSON.stringify(profile()), { status: 200 }),
    )
    await Promise.resolve()
    await Promise.resolve()
  })

  it('navigates between Profile and Weather and signs out', async () => {
    const { user } = await enterProfile()
    await loadedProfileFields()
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    await user.click(screen.getByRole('link', { name: 'Weather' }))
    expect(
      await screen.findByRole('heading', { name: /your weather, at a glance/i }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Profile' }))
    expect(
      await screen.findByRole('heading', { name: 'Your profile' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(
      await screen.findByRole('heading', { name: /sign in to your account/i }),
    ).toBeInTheDocument()
  })
})
