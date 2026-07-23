import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { App } from '../App'

const apiBaseUrl = 'https://localhost:7257'

function renderRegistration() {
  return render(
    <MemoryRouter initialEntries={['/register']}>
      <App apiBaseUrl={apiBaseUrl} />
    </MemoryRouter>,
  )
}

async function fillValidRegistration() {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText(/first name/i), 'Ada')
  await user.type(screen.getByLabelText(/last name/i), 'Lovelace')
  await user.type(screen.getByLabelText(/^username$/i), 'ada.lovelace')
  await user.type(screen.getByLabelText(/^email$/i), 'ada@example.test')
  await user.type(screen.getByLabelText(/^password$/i), 'SecurePass1')
  await user.type(screen.getByLabelText(/default city/i), ' London ')
  return user
}

function successfulRegistrationResponse() {
  return {
    userId: 12,
    username: 'ada.lovelace',
    email: 'ada@example.test',
    role: 1,
    accessToken: 'test-registration-token',
    expiresAtUtc: '2099-07-22T12:00:00Z',
  }
}

describe('registration flow', () => {
  it('registers a User, establishes the session, and routes to weather', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(successfulRegistrationResponse()), {
        status: 200,
      }),
    )
    renderRegistration()
    const user = await fillValidRegistration()
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(
      await screen.findByText('Your weather workspace is ready.'),
    ).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      'https://localhost:7257/api/auth/register',
    )
    expect(fetchMock.mock.calls[0][1]?.body).toBe(
      JSON.stringify({
        firstName: 'Ada',
        lastName: 'Lovelace',
        username: 'ada.lovelace',
        email: 'ada@example.test',
        password: 'SecurePass1',
        defaultCity: 'London',
      }),
    )
  })

  it('shows field-specific required validation and prevents submission', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    const user = userEvent.setup()
    renderRegistration()

    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByText('First name is required.')).toBeInTheDocument()
    expect(screen.getByText('Last name is required.')).toBeInTheDocument()
    expect(screen.getByText('Username is required.')).toBeInTheDocument()
    expect(screen.getByText('Email is required.')).toBeInTheDocument()
    expect(screen.getByText('Password is required.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects an invalid username format without a request', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    renderRegistration()
    const user = await fillValidRegistration()
    const username = screen.getByLabelText(/^username$/i)
    await user.clear(username)
    await user.type(username, 'invalid username')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(
      await screen.findByText(/use only letters, numbers/i),
    ).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects a weak password without a request', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    renderRegistration()
    const user = await fillValidRegistration()
    const password = screen.getByLabelText(/^password$/i)
    await user.clear(password)
    await user.type(password, 'weakpass')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(
      await screen.findByText(/at least 8 characters with uppercase/i),
    ).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows a safe duplicate-account message for HTTP 409', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ detail: 'raw detail' }), { status: 409 }),
    )
    renderRegistration()
    const user = await fillValidRegistration()
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That username or email is already in use.',
    )
    expect(screen.queryByText('raw detail')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toHaveValue('')
  })

  it('prevents duplicate registration submission while loading', async () => {
    let resolveRequest: ((response: Response) => void) | undefined
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveRequest = resolve
        }),
    )
    renderRegistration()
    const user = await fillValidRegistration()
    await user.dblClick(screen.getByRole('button', { name: /create account/i }))

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(
      screen.getByRole('button', { name: /creating account/i }),
    ).toBeDisabled()

    resolveRequest?.(
      new Response(JSON.stringify(successfulRegistrationResponse()), {
        status: 200,
      }),
    )
    expect(
      await screen.findByText('Your weather workspace is ready.'),
    ).toBeInTheDocument()
  })

  it('rejects a malformed success response without establishing a session', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ...successfulRegistrationResponse(),
          role: 99,
        }),
        { status: 200 },
      ),
    )
    renderRegistration()
    const user = await fillValidRegistration()
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /registration could not be completed/i,
    )
    expect(
      screen.getByRole('heading', { name: /create your account/i }),
    ).toBeInTheDocument()
  })
})
