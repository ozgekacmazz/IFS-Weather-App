import { ApiError, getSafeApiErrorMessage } from './apiError'

export type ResponseDecoder<T> = (value: unknown) => T
export type AccessTokenProvider = () => string | null

export class ApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly getAccessToken: AccessTokenProvider = () => null,
  ) {}

  async request<T>(
    path: string,
    init: RequestInit,
    decode: ResponseDecoder<T>,
    authenticated = false,
  ): Promise<T> {
    const targetUrl = this.createTargetUrl(path)
    const headers = new Headers(init.headers)

    if (init.body !== undefined && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }

    if (authenticated) {
      const accessToken = this.getAccessToken()

      if (!accessToken) {
        throw new ApiError('Authentication is required to complete this request.', 401)
      }

      headers.set('Authorization', `Bearer ${accessToken}`)
    }

    let response: Response

    try {
      response = await fetch(targetUrl, {
        ...init,
        headers,
        credentials: 'omit',
      })
    } catch {
      throw new ApiError(
        'The service could not be reached. Check your connection and try again.',
      )
    }

    let payload: unknown = null

    if (response.status !== 204) {
      try {
        payload = await response.json()
      } catch {
        if (response.ok) {
          throw new ApiError('The service returned an invalid response.', response.status)
        }
      }
    }

    if (!response.ok) {
      throw new ApiError(getSafeApiErrorMessage(response.status), response.status)
    }

    try {
      return decode(payload)
    } catch {
      throw new ApiError('The service returned an invalid response.', response.status)
    }
  }

  private createTargetUrl(path: string): URL {
    if (
      path.length === 0 ||
      path !== path.trim() ||
      !path.startsWith('api/') ||
      path.includes('\\') ||
      path.includes('#')
    ) {
      throw new ApiError('The request target is invalid.')
    }

    let targetUrl: URL

    try {
      targetUrl = new URL(path, `${this.baseUrl}/`)
    } catch {
      throw new ApiError('The request target is invalid.')
    }

    if (
      targetUrl.origin !== this.baseUrl ||
      !targetUrl.pathname.startsWith('/api/') ||
      targetUrl.username.length > 0 ||
      targetUrl.password.length > 0
    ) {
      throw new ApiError('The request target is invalid.')
    }

    return targetUrl
  }
}
