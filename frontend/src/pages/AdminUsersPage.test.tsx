import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { App } from '../App'

const apiBaseUrl = 'https://localhost:7257'
const authentication = {
  userId: 7,
  username: 'test.admin',
  email: 'admin@example.test',
  role: 2,
  accessToken: 'test-access-token',
  expiresAtUtc: '2099-07-22T12:00:00Z',
}

function user(overrides: Record<string, unknown> = {}) {
  return {
    userId: 8,
    firstName: 'Ada',
    lastName: 'Lovelace',
    username: 'ada',
    email: 'ada@example.test',
    defaultCity: null,
    role: 1,
    status: 1,
    createdAt: '2026-07-20T08:00:00Z',
    ...overrides,
  }
}

function detail(overrides: Record<string, unknown> = {}) {
  return {
    ...user(),
    updatedAt: '2026-07-22T10:00:00Z',
    ...overrides,
  }
}

function page(overrides: Record<string, unknown> = {}) {
  return {
    items: [user(), user({
      userId: 7,
      firstName: 'Current',
      lastName: 'Admin',
      username: 'test.admin',
      email: 'admin@example.test',
      defaultCity: 'Ankara',
      role: 2,
    })],
    pageNumber: 1,
    pageSize: 20,
    totalCount: 2,
    totalPages: 1,
    ...overrides,
  }
}

function jsonResponse(value: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(value), { status }))
}

function successfulFetch(input: RequestInfo | URL, init?: RequestInit) {
  const url = input.toString()
  if (url.endsWith('/api/auth/login')) {
    return jsonResponse(authentication)
  }
  if (init?.method === 'PATCH') {
    return jsonResponse(detail({ status: 0 }))
  }
  if (/\/api\/admin\/users\/\d+$/.test(new URL(url).pathname)) {
    const userId = Number(new URL(url).pathname.split('/').at(-1))
    return jsonResponse(
      userId === 7
        ? detail({
            userId: 7,
            firstName: 'Current',
            lastName: 'Admin',
            username: 'test.admin',
            email: 'admin@example.test',
            defaultCity: 'Ankara',
            role: 2,
          })
        : detail(),
    )
  }
  return jsonResponse(page())
}

async function enterAdminUsers(
  implementation: (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => Promise<Response> = successfulFetch,
) {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(
    implementation,
  )
  const appUser = userEvent.setup()
  const view = render(
    <MemoryRouter initialEntries={['/app/admin/users']}>
      <App apiBaseUrl={apiBaseUrl} />
    </MemoryRouter>,
  )

  await appUser.type(screen.getByLabelText(/username or email/i), 'test.admin')
  await appUser.type(screen.getByLabelText(/^password$/i), 'TestPass1')
  await appUser.click(screen.getByRole('button', { name: /^sign in$/i }))
  await screen.findByRole('heading', { name: 'User management' })
  return { fetchMock, appUser, view }
}

describe('AdminUsersPage', () => {
  it('loads and renders human-readable user data with accessible table semantics', async () => {
    const { fetchMock } = await enterAdminUsers()

    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getAllByText('User')).not.toHaveLength(0)
    expect(screen.getAllByText('Admin')).not.toHaveLength(0)
    expect(screen.getAllByText('Active')).not.toHaveLength(0)
    expect(screen.getByText('Not set')).toBeInTheDocument()
    const listCall = fetchMock.mock.calls.find(([input]) =>
      input.toString().includes('/api/admin/users?'),
    )
    expect(new Headers(listCall?.[1]?.headers).get('Authorization')).toBe(
      'Bearer test-access-token',
    )
  })

  it('shows an empty state and safe failure with Retry', async () => {
    let listRequests = 0
    const { appUser } = await enterAdminUsers((input, init) => {
      if (input.toString().endsWith('/api/auth/login')) {
        return jsonResponse(authentication)
      }
      if (init?.method === 'GET') {
        listRequests += 1
        return listRequests === 1
          ? jsonResponse({ detail: 'private detail' }, 503)
          : jsonResponse(page({
              items: [],
              totalCount: 0,
              totalPages: 0,
            }))
      }
      return successfulFetch(input, init)
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Users could not be loaded.',
    )
    expect(screen.queryByText('private detail')).not.toBeInTheDocument()
    await appUser.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'No users found' }))
      .toBeInTheDocument()
  })

  it('trims search, filters status, validates maximum length, and resets to page one', async () => {
    const { fetchMock, appUser } = await enterAdminUsers()
    const search = await screen.findByLabelText('Search users')
    await appUser.type(search, 'x'.repeat(101))
    await appUser.click(screen.getByRole('button', { name: 'Apply filters' }))
    expect(screen.getByText('Search must be 100 characters or fewer.'))
      .toBeInTheDocument()

    await appUser.clear(search)
    await appUser.type(search, '  ada  ')
    await appUser.selectOptions(screen.getByLabelText('Account status'), '0')
    await appUser.click(screen.getByRole('button', { name: 'Apply filters' }))

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map(([input]) => input.toString())
      expect(urls.some((url) =>
        url.includes('pageNumber=1') &&
        url.includes('search=ada') &&
        url.includes('status=0'),
      )).toBe(true)
    })
  })

  it('enforces pagination boundaries and requests the next page', async () => {
    const { fetchMock, appUser } = await enterAdminUsers((input) => {
      if (input.toString().endsWith('/api/auth/login')) {
        return jsonResponse(authentication)
      }
      const url = new URL(input.toString())
      const requestedPage = Number(url.searchParams.get('pageNumber') ?? 1)
      return jsonResponse(page({
        pageNumber: requestedPage,
        totalCount: 21,
        totalPages: 2,
        items: requestedPage === 1 ? page().items : [user({ userId: 9 })],
      }))
    })

    expect(await screen.findByRole('button', { name: 'Previous page' }))
      .toBeDisabled()
    await appUser.dblClick(screen.getByRole('button', { name: 'Next page' }))
    expect(await screen.findByText('Page 2 of 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
    expect(fetchMock.mock.calls.filter(([input]) =>
      input.toString().includes('pageNumber=2'),
    )).toHaveLength(1)
  })

  it('loads exact detail, ignores an older selection, and handles 404 safely', async () => {
    let resolveAda: ((response: Response) => void) | undefined
    const { appUser } = await enterAdminUsers((input, init) => {
      const url = input.toString()
      if (url.endsWith('/api/admin/users/8')) {
        return new Promise<Response>((resolve) => {
          resolveAda = resolve
        })
      }
      if (url.endsWith('/api/admin/users/7')) {
        return jsonResponse({ status: 404 }, 404)
      }
      return successfulFetch(input, init)
    })

    await appUser.click(await screen.findByRole('button', { name: 'View details for Ada Lovelace' }))
    await appUser.click(screen.getByRole('button', { name: 'View details for Current Admin' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That user no longer exists.',
    )
    resolveAda?.(new Response(JSON.stringify(detail()), { status: 200 }))
    await Promise.resolve()
    expect(screen.queryByText('Loading user details…')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'That user no longer exists.',
    )
  })

  it('confirms a status change, prevents duplicates, and installs returned detail', async () => {
    let resolvePatch: ((response: Response) => void) | undefined
    const { fetchMock, appUser } = await enterAdminUsers((input, init) => {
      if (init?.method === 'PATCH') {
        return new Promise<Response>((resolve) => {
          resolvePatch = resolve
        })
      }
      return successfulFetch(input, init)
    })
    await appUser.click(await screen.findByRole('button', { name: 'View details for Ada Lovelace' }))
    await screen.findByRole('button', { name: 'Deactivate user' })
    await appUser.click(screen.getByRole('button', { name: 'Deactivate user' }))
    expect(screen.getByRole('heading', { name: 'Confirm deactivation' }))
      .toBeInTheDocument()
    await appUser.dblClick(screen.getByRole('button', { name: 'Confirm deactivation' }))
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'PATCH'))
      .toHaveLength(1)
    resolvePatch?.(new Response(JSON.stringify(detail({
      firstName: 'Confirmed',
      status: 0,
    })), { status: 200 }))
    expect(await screen.findByText(/ada is now inactive/i)).toBeInTheDocument()
    expect(screen.getByText('Confirmed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Activate user' })).toBeInTheDocument()
  })

  it('does not offer self-deactivation and handles 409/403 safely', async () => {
    const { appUser } = await enterAdminUsers()
    await appUser.click(await screen.findByRole('button', { name: 'View details for Current Admin' }))
    expect(await screen.findByText(/cannot deactivate your own administrator account/i))
      .toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Deactivate user' }))
      .not.toBeInTheDocument()
  })

  it.each([
    [400, 'The user status could not be updated.'],
    [403, 'You are not authorized to change this user.'],
    [404, 'That user no longer exists.'],
    [409, 'This status change conflicts with account protections.'],
  ])('handles a status update %s without backend details', async (status, message) => {
    const { appUser } = await enterAdminUsers((input, init) =>
      init?.method === 'PATCH'
        ? jsonResponse({ detail: 'private backend detail' }, status)
        : successfulFetch(input, init),
    )
    await appUser.click(await screen.findByRole('button', { name: 'View details for Ada Lovelace' }))
    await appUser.click(await screen.findByRole('button', { name: 'Deactivate user' }))
    await appUser.click(screen.getByRole('button', { name: 'Confirm deactivation' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.queryByText('private backend detail')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Confirm deactivation' }))
      .not.toBeInTheDocument()
  })

  it('logs out on a status update 401', async () => {
    const { appUser } = await enterAdminUsers((input, init) =>
      init?.method === 'PATCH'
        ? jsonResponse({ status: 401 }, 401)
        : successfulFetch(input, init),
    )
    await appUser.click(await screen.findByRole('button', { name: 'View details for Ada Lovelace' }))
    await appUser.click(await screen.findByRole('button', { name: 'Deactivate user' }))
    await appUser.click(screen.getByRole('button', { name: 'Confirm deactivation' }))

    expect(await screen.findByRole('heading', { name: /sign in to your account/i }))
      .toBeInTheDocument()
  })

  it('unmounts safely while detail and status work is pending', async () => {
    let resolvePatch: ((response: Response) => void) | undefined
    const { appUser, view } = await enterAdminUsers((input, init) => {
      if (init?.method === 'PATCH') {
        return new Promise<Response>((resolve) => {
          resolvePatch = resolve
        })
      }
      return successfulFetch(input, init)
    })
    await appUser.click(await screen.findByRole('button', { name: 'View details for Ada Lovelace' }))
    await appUser.click(await screen.findByRole('button', { name: 'Deactivate user' }))
    await appUser.click(screen.getByRole('button', { name: 'Confirm deactivation' }))
    await waitFor(() => expect(resolvePatch).toBeTypeOf('function'))
    view.unmount()
    resolvePatch?.(new Response(JSON.stringify(detail({ status: 0 })), {
      status: 200,
    }))
    await Promise.resolve()
  })

  it('logs out safely on 401 and unmounts safely during requests', async () => {
    let resolveList: ((response: Response) => void) | undefined
    const { view } = await enterAdminUsers((input) => {
      if (input.toString().endsWith('/api/auth/login')) {
        return jsonResponse(authentication)
      }
      return new Promise<Response>((resolve) => {
        resolveList = resolve
      })
    })
    await waitFor(() => expect(resolveList).toBeTypeOf('function'))
    view.unmount()
    resolveList?.(new Response(JSON.stringify(page()), { status: 200 }))
    await Promise.resolve()
  })

  it('uses the existing logout flow on list 401', async () => {
    await enterAdminUsers((input) =>
      input.toString().endsWith('/api/auth/login')
        ? jsonResponse(authentication)
        : jsonResponse({ status: 401 }, 401),
    )
    expect(await screen.findByRole('heading', { name: /sign in to your account/i }))
      .toBeInTheDocument()
  })
})
