export class EnvironmentConfigurationError extends Error {
  constructor() {
    super('The frontend API configuration is missing or invalid.')
    this.name = 'EnvironmentConfigurationError'
  }
}

export function parseApiBaseUrl(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new EnvironmentConfigurationError()
  }

  try {
    const url = new URL(value.trim())
    const isHttp = url.protocol === 'http:' || url.protocol === 'https:'
    const hasOnlyOrigin =
      url.pathname === '/' &&
      url.search.length === 0 &&
      url.hash.length === 0 &&
      url.username.length === 0 &&
      url.password.length === 0

    if (!isHttp || !hasOnlyOrigin) {
      throw new EnvironmentConfigurationError()
    }

    return url.origin
  } catch (error: unknown) {
    if (error instanceof EnvironmentConfigurationError) {
      throw error
    }

    throw new EnvironmentConfigurationError()
  }
}
