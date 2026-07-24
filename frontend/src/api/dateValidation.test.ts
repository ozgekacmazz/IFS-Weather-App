import { describe, expect, it } from 'vitest'
import { isDateOnly, isExplicitTimestamp } from './dateValidation'
import { decodeCurrentWeather } from './weatherApi'

function weather(updatedAt: string) {
  return {
    weatherId: 1,
    weatherDate: '2026-07-23',
    cityName: 'Istanbul',
    temperature: 24.5,
    minimumTemperature: null,
    maximumTemperature: null,
    averageHumidity: null,
    maximumWindSpeedKph: null,
    precipitationProbability: null,
    mainStatus: 'Clear',
    updatedAt,
    recommendations: [],
  }
}

describe('ASP.NET date and timestamp decoding', () => {
  it.each([
    '2026-07-23T08:00:00Z',
    '2026-07-23T08:00:00.1234567Z',
    '2026-07-23T08:00:00+03:00',
    '2026-07-23T08:00:00.12-04:30',
  ])('accepts a valid explicit timestamp: %s', (timestamp) => {
    expect(isExplicitTimestamp(timestamp)).toBe(true)
    expect(decodeCurrentWeather(weather(timestamp)).updatedAt).toBe(timestamp)
  })

  it.each([
    '2026-02-30T08:00:00Z',
    '2026-13-01T08:00:00Z',
    '2026-07-23T24:00:00Z',
    '2026-07-23T08:60:00Z',
    '2026-07-23T08:00:60Z',
    '2026-07-23T08:00:00+14:01',
    '2026-07-23 08:00:00Z',
    '2026-07-23T08:00:00',
  ])('rejects an invalid or malformed timestamp: %s', (timestamp) => {
    expect(isExplicitTimestamp(timestamp)).toBe(false)
    expect(() => decodeCurrentWeather(weather(timestamp))).toThrow(
      'Invalid current weather response',
    )
  })

  it.each(['0000-01-01', '2026-02-29', '2026-00-01', '2026-07-32'])(
    'rejects a date outside the DateOnly contract: %s',
    (date) => {
      expect(isDateOnly(date)).toBe(false)
    },
  )

  it.each(['0001-01-01', '2024-02-29', '9999-12-31'])(
    'accepts a representable DateOnly value: %s',
    (date) => {
      expect(isDateOnly(date)).toBe(true)
    },
  )
})
