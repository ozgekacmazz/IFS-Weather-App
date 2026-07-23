import { describe, expect, it } from 'vitest'
import {
  EnvironmentConfigurationError,
  parseApiBaseUrl,
} from './environment'

describe('parseApiBaseUrl', () => {
  it('returns a normalized HTTP or HTTPS origin', () => {
    expect(parseApiBaseUrl(' https://localhost:7257/ ')).toBe(
      'https://localhost:7257',
    )
  })

  it.each([
    undefined,
    '',
    'ftp://localhost:7257',
    'https://localhost:7257/api',
    'https://user:password@localhost:7257',
  ])('rejects missing or unsafe configuration without exposing it', (value) => {
    expect(() => parseApiBaseUrl(value)).toThrow(EnvironmentConfigurationError)
    expect(() => parseApiBaseUrl(value)).toThrow(
      'The frontend API configuration is missing or invalid.',
    )
  })
})
