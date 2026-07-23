import { describe, expect, it, vi } from 'vitest'
import { ApiClient } from './apiClient'

describe('ApiClient', () => {
  it('attaches the in-memory bearer token only to authenticated requests', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    const client = new ApiClient('https://localhost:7257', () => 'test-token')

    await client.request(
      'api/profile',
      { method: 'GET' },
      (value) => value,
      true,
    )

    const [, options] = fetchMock.mock.calls[0]
    const headers = new Headers(options?.headers)

    expect(headers.get('Authorization')).toBe('Bearer test-token')
    expect(options?.credentials).toBe('omit')
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      'https://localhost:7257/api/profile',
    )
  })

  it('does not attach a token to anonymous requests', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    const client = new ApiClient('https://localhost:7257', () => 'test-token')

    await client.request('api/public', { method: 'GET' }, (value) => value)

    const [, options] = fetchMock.mock.calls[0]
    expect(new Headers(options?.headers).has('Authorization')).toBe(false)
  })

  it('rejects an authenticated cross-origin absolute URL before reading the token', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    const tokenProvider = vi.fn(() => 'test-token')
    const client = new ApiClient('https://localhost:7257', tokenProvider)

    await expect(
      client.request(
        'https://another-origin.example/api/profile',
        { method: 'GET' },
        (value) => value,
        true,
      ),
    ).rejects.toThrow('The request target is invalid.')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(tokenProvider).not.toHaveBeenCalled()
  })

  it('rejects a protocol-relative cross-origin URL before fetch', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    const tokenProvider = vi.fn(() => 'test-token')
    const client = new ApiClient('https://localhost:7257', tokenProvider)

    await expect(
      client.request(
        '//another-origin.example/api/profile',
        { method: 'GET' },
        (value) => value,
        true,
      ),
    ).rejects.toThrow('The request target is invalid.')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(tokenProvider).not.toHaveBeenCalled()
  })
})
