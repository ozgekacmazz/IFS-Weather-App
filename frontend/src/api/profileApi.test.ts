import { describe, expect, it, vi } from 'vitest'
import { ApiClient } from './apiClient'
import {
  getProfile,
  updateDefaultCity,
  updateProfile,
  type UserProfile,
} from './profileApi'

const apiBaseUrl = 'https://localhost:7257'
const token = 'test-access-token'

function profile(overrides: Partial<UserProfile> = {}): UserProfile {
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

function client() {
  return new ApiClient(apiBaseUrl, () => token)
}

describe('profile API', () => {
  it('sends the exact authenticated GET profile request and decodes the response', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(profile()), { status: 200 }),
    )

    await expect(getProfile(client())).resolves.toEqual(profile())
    const [url, options] = fetchMock.mock.calls[0]
    expect(url.toString()).toBe(`${apiBaseUrl}/api/profile`)
    expect(options?.method).toBe('GET')
    expect(new Headers(options?.headers).get('Authorization')).toBe(
      `Bearer ${token}`,
    )
  })

  it('sends the exact PUT contract with null password fields', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(profile({ defaultCity: null })), {
        status: 200,
      }),
    )

    await updateProfile(client(), {
      firstName: 'Test',
      lastName: 'User',
      defaultCity: null,
      currentPassword: null,
      newPassword: null,
    })

    const [url, options] = fetchMock.mock.calls[0]
    expect(url.toString()).toBe(`${apiBaseUrl}/api/profile`)
    expect(options?.method).toBe('PUT')
    expect(new Headers(options?.headers).get('Authorization')).toBe(
      `Bearer ${token}`,
    )
    expect(JSON.parse(String(options?.body))).toEqual({
      firstName: 'Test',
      lastName: 'User',
      defaultCity: null,
      currentPassword: null,
      newPassword: null,
    })
  })

  it('preserves password whitespace and has no confirmation property', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(profile()), { status: 200 }),
    )

    await updateProfile(client(), {
      firstName: 'Test',
      lastName: 'User',
      defaultCity: 'Istanbul',
      currentPassword: ' current pass ',
      newPassword: ' NewPass1 ',
    })

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
    expect(body.currentPassword).toBe(' current pass ')
    expect(body.newPassword).toBe(' NewPass1 ')
    expect(body).not.toHaveProperty('confirmNewPassword')
  })

  it('keeps updateDefaultCity compatible with the established contract', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(profile({ defaultCity: 'Ankara' })), {
        status: 200,
      }),
    )

    await updateDefaultCity(client(), profile(), 'Ankara')

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      firstName: 'Test',
      lastName: 'User',
      defaultCity: 'Ankara',
      currentPassword: null,
      newPassword: null,
    })
  })

  it('rejects a malformed successful profile response safely', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ...profile(), role: 99 }), { status: 200 }),
    )

    await expect(getProfile(client())).rejects.toMatchObject({
      message: 'The service returned an invalid response.',
      status: 200,
    })
  })
})
