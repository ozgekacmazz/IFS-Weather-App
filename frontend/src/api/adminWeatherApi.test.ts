import { describe, expect, it, vi } from 'vitest'
import { ApiClient } from './apiClient'
import {
  createAdminWeather,
  deleteAdminWeather,
  getAdminWeather,
  getAdminWeatherById,
  previewAdminLiveWeather,
  saveAdminLiveWeather,
  updateAdminWeather,
} from './adminWeatherApi'

const apiBaseUrl = 'https://localhost:7257'
const token = 'test-access-token'

function weather(overrides: Record<string, unknown> = {}) {
  return {
    weatherId: 4,
    weatherDate: '2026-07-23',
    cityName: 'Denizli',
    temperature: 32.5,
    minimumTemperature: null,
    maximumTemperature: null,
    averageHumidity: null,
    maximumWindSpeedKph: null,
    precipitationProbability: null,
    mainStatus: 'Clear',
    createdAt: '2026-07-23T08:00:00Z',
    updatedAt: '2026-07-23T08:00:00Z',
    ...overrides,
  }
}

function page(overrides: Record<string, unknown> = {}) {
  return {
    items: [weather()],
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

describe('admin weather API', () => {
  it('sends the exact list query with fixed paging, trimmed city, and date', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(page()), { status: 200 }),
    )
    await getAdminWeather(client(), {
      pageNumber: 1,
      pageSize: 20,
      city: '  Denizli  ',
      date: '2026-07-23',
    })
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      `${apiBaseUrl}/api/admin/weather?pageNumber=1&pageSize=20&city=Denizli&date=2026-07-23`,
    )
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('Authorization'))
      .toBe(`Bearer ${token}`)
  })

  it('omits blank city and invalid or empty date filters', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(page()), { status: 200 }),
    )
    await getAdminWeather(client(), {
      pageNumber: 1,
      pageSize: 20,
      city: '   ',
      date: '2026-02-30',
    })
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      `${apiBaseUrl}/api/admin/weather?pageNumber=1&pageSize=20`,
    )
  })

  it('decodes list and detail responses and exact detail URL', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(page()), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(weather()), { status: 200 }))
    await expect(getAdminWeather(client(), { pageNumber: 1, pageSize: 20 }))
      .resolves.toMatchObject({ totalCount: 1 })
    await expect(getAdminWeatherById(client(), 4)).resolves.toEqual(weather())
    expect(fetchMock.mock.calls[1][0].toString()).toBe(
      `${apiBaseUrl}/api/admin/weather/4`,
    )
  })

  it('sends exact POST body and returns the authoritative record', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(weather()), { status: 201 }),
    )
    const request = {
      weatherDate: '2026-07-23',
      cityName: 'Denizli',
      temperature: 32.5,
      minimumTemperature: null,
      maximumTemperature: null,
      averageHumidity: null,
      maximumWindSpeedKph: null,
      precipitationProbability: null,
      mainStatus: 'Clear',
    }
    await expect(createAdminWeather(client(), request)).resolves.toEqual(weather())
    const [url, options] = fetchMock.mock.calls[0]
    expect(url.toString()).toBe(`${apiBaseUrl}/api/admin/weather`)
    expect(options?.method).toBe('POST')
    expect(options?.body).toBe(JSON.stringify(request))
  })

  it('sends exact PUT body and returns the authoritative updated record', async () => {
    const updated = weather({
      cityName: 'İzmir',
      temperature: 28,
      minimumTemperature: null,
      maximumTemperature: null,
      averageHumidity: null,
      maximumWindSpeedKph: null,
      precipitationProbability: null,
      mainStatus: 'Partly cloudy',
      updatedAt: '2026-07-25T09:30:00Z',
    })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(updated), { status: 200 }),
    )
    const request = {
      weatherDate: '2026-07-23',
      cityName: 'İzmir',
      temperature: 28,
      minimumTemperature: null,
      maximumTemperature: null,
      averageHumidity: null,
      maximumWindSpeedKph: null,
      precipitationProbability: null,
      mainStatus: 'Partly cloudy',
    }

    await expect(updateAdminWeather(client(), 4, request)).resolves.toEqual(updated)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url.toString()).toBe(`${apiBaseUrl}/api/admin/weather/4`)
    expect(options?.method).toBe('PUT')
    expect(options?.body).toBe(JSON.stringify(request))
  })

  it('sends exact DELETE and accepts 204', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 204 }),
    )
    await expect(deleteAdminWeather(client(), 4)).resolves.toBeUndefined()
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      `${apiBaseUrl}/api/admin/weather/4`,
    )
    expect(fetchMock.mock.calls[0][1]?.method).toBe('DELETE')
  })

  it('previews by coordinates and explicitly saves the returned preview', async () => {
    const preview = {
      latitude: 38.423734,
      longitude: 27.142826,
      cityName: 'İzmir',
      displayLabel: 'İzmir, Türkiye',
      weatherDate: '2026-07-24',
      temperature: 28.5,
      minimumTemperature: 22,
      maximumTemperature: 31,
      averageHumidity: 64,
      maximumWindSpeedKph: 22.5,
      precipitationProbability: 70,
      mainStatus: 'Sunny',
    }
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify(preview), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          inserted: true,
          weather: weather({
            weatherDate: preview.weatherDate,
            cityName: preview.cityName,
            temperature: preview.temperature,
            mainStatus: preview.mainStatus,
          }),
        }), { status: 200 }),
      )

    await expect(previewAdminLiveWeather(client(), {
      latitude: preview.latitude,
      longitude: preview.longitude,
      cityName: preview.cityName,
      displayLabel: preview.displayLabel,
    })).resolves.toEqual(preview)
    await expect(saveAdminLiveWeather(client(), preview)).resolves.toMatchObject({
      inserted: true,
    })

    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      `${apiBaseUrl}/api/admin/weather/live/preview`,
    )
    expect(fetchMock.mock.calls[1][0].toString()).toBe(
      `${apiBaseUrl}/api/admin/weather/live/save`,
    )
    expect(fetchMock.mock.calls[1][1]?.body).toBe(JSON.stringify(preview))
  })

  it.each([
    ['weatherId', weather({ weatherId: 0 })],
    ['date', weather({ weatherDate: '2026-02-30' })],
    ['temperature', weather({ temperature: Number.POSITIVE_INFINITY })],
    ['city', weather({ cityName: '   ' })],
    ['status', weather({ mainStatus: '' })],
    ['created timestamp', weather({ createdAt: '2026-07-23T08:00:00' })],
    ['updated timestamp', weather({ updatedAt: 'not-a-date' })],
  ])('rejects malformed successful %s values', async (_name, payload) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(payload), { status: 200 }),
    )
    await expect(getAdminWeatherById(client(), 4)).rejects.toMatchObject({
      message: 'The service returned an invalid response.',
      status: 200,
    })
  })

  it.each([
    page({ totalPages: 2 }),
    page({ totalCount: -1 }),
    page({ items: 'not-an-array' }),
    page({ items: [weather({ weatherId: 'bad' })] }),
  ])('rejects inconsistent pagination and malformed items', async (payload) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(payload), { status: 200 }),
    )
    await expect(
      getAdminWeather(client(), { pageNumber: 1, pageSize: 20 }),
    ).rejects.toMatchObject({ status: 200 })
  })
})
