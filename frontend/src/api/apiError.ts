export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number | null = null,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function getSafeApiErrorMessage(status: number): string {
  if (status === 401 || status === 403) {
    return 'Authentication is required to complete this request.'
  }

  if (status === 400) {
    return 'The request could not be completed. Check the submitted information.'
  }

  if (status === 429) {
    return 'Too many requests were made. Please try again later.'
  }

  if (status >= 500) {
    return 'The service is temporarily unavailable. Please try again later.'
  }

  return 'The request could not be completed.'
}
