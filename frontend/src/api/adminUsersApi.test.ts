import { describe, expect, it, vi } from 'vitest'
import { ApiClient } from './apiClient'
import {
  AdminUserStatuses,
  getAdminUser,
  getAdminUsers,
  updateAdminUserStatus,
} from './adminUsersApi'

const apiBaseUrl = 'https://localhost:7257'
const token = 'test-access-token'

function summary(overrides: Record<string, unknown> = {}) {
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
    ...summary(),
    updatedAt: '2026-07-21T09:00:00Z',
    ...overrides,
  }
}

function page(overrides: Record<string, unknown> = {}) {
  return {
    items: [summary()],
    pageNumber: 1,
    pageSize: 20,
    totalCount: 1,
    totalPages: 1,
    ...overrides,
  }
}

function client() {
  return new ApiClient(apiBaseUrl, () => token)
}

describe('admin users API', () => {
  it('sends the exact authenticated list query and decodes pagination and summaries', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify(page({ pageNumber: 2, totalCount: 21, totalPages: 2 })),
        { status: 200 },
      ),
    )

    await expect(
      getAdminUsers(client(), {
        pageNumber: 2,
        pageSize: 20,
        search: '  ada  ',
        status: AdminUserStatuses.Active,
      }),
    ).resolves.toMatchObject({ pageNumber: 2 })

    const [url, options] = fetchMock.mock.calls[0]
    expect(url.toString()).toBe(
      `${apiBaseUrl}/api/admin/users?pageNumber=2&pageSize=20&search=ada&status=1`,
    )
    expect(options?.method).toBe('GET')
    expect(new Headers(options?.headers).get('Authorization')).toBe(
      `Bearer ${token}`,
    )
  })

  it('decodes a valid page with both roles, statuses, and nullable city', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify(
          page({
            items: [
              summary(),
              summary({
                userId: 9,
                username: 'admin',
                email: 'admin@example.test',
                defaultCity: 'Ankara',
                role: 2,
                status: 0,
              }),
            ],
            totalCount: 2,
          }),
        ),
        { status: 200 },
      ),
    )

    const result = await getAdminUsers(client(), {
      pageNumber: 1,
      pageSize: 20,
    })
    expect(result.items).toHaveLength(2)
    expect(result.items[0].defaultCity).toBeNull()
    expect(result.items[1]).toMatchObject({ role: 2, status: 0 })
  })

  it('omits blank search and unset status', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(page()), { status: 200 }),
    )

    await getAdminUsers(client(), {
      pageNumber: 1,
      pageSize: 20,
      search: '   ',
    })

    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      `${apiBaseUrl}/api/admin/users?pageNumber=1&pageSize=20`,
    )
  })

  it('decodes detail and sends the exact authenticated detail URL', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(detail()), { status: 200 }),
    )

    await expect(getAdminUser(client(), 8)).resolves.toEqual(detail())
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      `${apiBaseUrl}/api/admin/users/8`,
    )
  })

  it('sends the exact PATCH contract and decodes the confirmed detail', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify(detail({ status: AdminUserStatuses.Passive })),
        { status: 200 },
      ),
    )

    await updateAdminUserStatus(client(), 8, AdminUserStatuses.Passive)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url.toString()).toBe(`${apiBaseUrl}/api/admin/users/8/status`)
    expect(options?.method).toBe('PATCH')
    expect(options?.body).toBe(JSON.stringify({ status: 0 }))
    expect(new Headers(options?.headers).get('Authorization')).toBe(
      `Bearer ${token}`,
    )
  })

  it.each([
    ['invalid role', page({ items: [summary({ role: 3 })] })],
    ['invalid status', page({ items: [summary({ status: 2 })] })],
    ['invalid date', page({ items: [summary({ createdAt: 'not-a-date' })] })],
    ['invalid metadata', page({ totalPages: 2 })],
    ['invalid count', page({ totalCount: -1 })],
  ])('rejects malformed success responses: %s', async (_name, payload) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(payload), { status: 200 }),
    )

    await expect(
      getAdminUsers(client(), { pageNumber: 1, pageSize: 20 }),
    ).rejects.toMatchObject({
      message: 'The service returned an invalid response.',
      status: 200,
    })
  })

  it('rejects an invalid detail update date', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(detail({ updatedAt: 'not-a-date' })), {
        status: 200,
      }),
    )

    await expect(getAdminUser(client(), 8)).rejects.toMatchObject({
      status: 200,
    })
  })
})
