import { describe, expect, it, vi } from 'vitest'
import { ApiClient } from './apiClient'
import {
  decodeExternalWeatherForecast,
  getExternalWeatherForecast,
} from './externalWeatherApi'

const apiBaseUrl = 'https://localhost:7257'

function forecast() {
  return {
    cityName: 'New York',
    country: 'United States of America',
    startDate: '2026-07-23',
    days: [
      {
        date: '2026-07-23',
        minimumTemperature: 20.1,
        maximumTemperature: 29.4,
        averageTemperature: 24.7,
        mainStatus: 'Partly cloudy',
        iconUrl: 'https://cdn.weatherapi.com/icon.png',
      },
      {
        date: '2026-07-24',
        minimumTemperature: 19,
        maximumTemperature: 27,
        averageTemperature: 23,
        mainStatus: 'Rain',
        iconUrl: null,
      },
    ],
  }
}

describe('external weather API', () => {
  it('sends the exact authenticated and encoded request', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(forecast()), { status: 200 }),
    )
    const client = new ApiClient(apiBaseUrl, () => 'test-token')

    await getExternalWeatherForecast(client, 'New York & Queens', 2)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url.toString()).toBe(
      `${apiBaseUrl}/api/weather/external/forecast?city=New+York+%26+Queens&days=2`,
    )
    expect(options?.method).toBe('GET')
    expect(new Headers(options?.headers).get('Authorization')).toBe(
      'Bearer test-token',
    )
  })

  it('decodes the complete backend DTO contract', () => {
    expect(decodeExternalWeatherForecast(forecast())).toEqual(forecast())
  })

  it.each([
    null,
    {},
    { ...forecast(), cityName: '' },
    { ...forecast(), country: '' },
    { ...forecast(), startDate: '23/07/2026' },
    { ...forecast(), days: [] },
    { ...forecast(), days: [...forecast().days, ...forecast().days] },
  ])('rejects malformed top-level responses', (value) => {
    expect(() => decodeExternalWeatherForecast(value)).toThrow()
  })

  it.each([
    { minimumTemperature: Number.NaN },
    { maximumTemperature: Number.POSITIVE_INFINITY },
    { averageTemperature: '24' },
    { date: '2026-02-30' },
    { mainStatus: ' ' },
    { iconUrl: 42 },
    {
      minimumTemperature: 25,
      averageTemperature: 24,
      maximumTemperature: 30,
    },
    {
      minimumTemperature: 20,
      averageTemperature: 31,
      maximumTemperature: 30,
    },
  ])('rejects malformed daily forecast entries', (override) => {
    const value = forecast()
    value.days[0] = { ...value.days[0], ...override } as typeof value.days[0]
    expect(() => decodeExternalWeatherForecast(value)).toThrow()
  })

  it('rejects duplicate, unordered, and start-date-inconsistent days', () => {
    const duplicate = forecast()
    duplicate.days[1].date = duplicate.days[0].date
    expect(() => decodeExternalWeatherForecast(duplicate)).toThrow()

    const inconsistent = forecast()
    inconsistent.startDate = '2026-07-24'
    expect(() => decodeExternalWeatherForecast(inconsistent)).toThrow()
  })

  it.each([1, 2, 3] as const)('includes supported day value %s', async (days) => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(forecast()), { status: 200 }),
    )

    await getExternalWeatherForecast(
      new ApiClient(apiBaseUrl, () => 'test-token'),
      'Ankara',
      days,
    )

    expect(fetchMock.mock.calls[0][0].toString()).toContain(`days=${days}`)
  })
})
