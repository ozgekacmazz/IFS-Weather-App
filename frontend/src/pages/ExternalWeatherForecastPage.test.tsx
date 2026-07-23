import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { App } from '../App'

const apiBaseUrl = 'https://localhost:7257'

const authentication = {
  userId: 7,
  username: 'test.user',
  email: 'person@example.test',
  role: 1,
  accessToken: 'test-access-token',
  expiresAtUtc: '2099-07-22T12:00:00Z',
}

function profile(defaultCity: string | null = 'Istanbul') {
  return {
    userId: 7,
    firstName: 'Test',
    lastName: 'User',
    username: 'test.user',
    email: 'person@example.test',
    defaultCity,
    role: 1,
    status: 1,
    createdAt: '2026-07-20T08:00:00Z',
  }
}

function forecast(city = 'Ankara', count = 3) {
  return {
    cityName: city,
    country: 'Türkiye',
    startDate: '2026-07-23',
    days: [
      {
        date: '2026-07-23',
        minimumTemperature: 18,
        maximumTemperature: 31,
        averageTemperature: 24.5,
        mainStatus: 'Sunny',
        iconUrl: '//cdn.weatherapi.com/day.png',
      },
      {
        date: '2026-07-24',
        minimumTemperature: 17,
        maximumTemperature: 29,
        averageTemperature: 23,
        mainStatus: 'Partly cloudy',
        iconUrl: null,
      },
      {
        date: '2026-07-25',
        minimumTemperature: 16,
        maximumTemperature: 26,
        averageTemperature: 21,
        mainStatus: 'Rain',
        iconUrl: null,
      },
    ].slice(0, count),
  }
}

function response(value: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(value), { status }))
}

async function enterLivePage(
  implementation: (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => Promise<Response>,
) {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(implementation)
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/login']}>
      <App apiBaseUrl={apiBaseUrl} />
    </MemoryRouter>,
  )

  await user.type(screen.getByLabelText(/username or email/i), 'test.user')
  await user.type(screen.getByLabelText(/^password$/i), 'TestPass1')
  await user.click(screen.getByRole('button', { name: /^sign in$/i }))
  await screen.findByRole('heading', { name: /your weather, at a glance/i })
  await user.click(screen.getByRole('link', { name: 'Live forecast' }))
  await screen.findByRole('heading', { name: /explore live weather anywhere/i })

  return { fetchMock, user }
}

function successfulFetch(input: RequestInfo | URL) {
  const url = input.toString()
  if (url.endsWith('/api/auth/login')) return response(authentication)
  if (url.endsWith('/api/profile')) return response(profile())
  if (url.includes('/api/weather/external/forecast?')) {
    return response(forecast())
  }
  if (url.endsWith('/api/weather/today')) {
    return response({
      weatherId: 1,
      weatherDate: '2026-07-23',
      cityName: 'Istanbul',
      temperature: 24,
      mainStatus: 'Clear',
      updatedAt: '2026-07-23T08:00:00Z',
    })
  }
  return response({
    cityName: 'Istanbul',
    startDate: '2026-07-20',
    requestedDays: 7,
    items: [],
  })
}

describe('ExternalWeatherForecastPage', () => {
  it('prefills the profile city without automatically requesting live data', async () => {
    const { fetchMock } = await enterLivePage(successfulFetch)
    expect(await screen.findByLabelText('City')).toHaveValue('Istanbul')
    expect(screen.getByText(/no live provider request is made/i)).toBeInTheDocument()
    expect(
      fetchMock.mock.calls.some(([input]) =>
        input.toString().includes('/api/weather/external/forecast?'),
      ),
    ).toBe(false)
  })

  it.each([1, 2, 3])('requests and renders a valid %s-day forecast', async (days) => {
    const { fetchMock, user } = await enterLivePage((input) => {
      if (input.toString().includes('/api/weather/external/forecast?')) {
        return response(forecast('Ankara', days))
      }
      return successfulFetch(input)
    })
    const city = screen.getByLabelText('City')
    await user.clear(city)
    await user.type(city, ' Ankara ')
    await user.selectOptions(screen.getByLabelText('Forecast length'), String(days))
    await user.click(screen.getByRole('button', { name: 'Get live forecast' }))

    expect(
      await screen.findByRole('heading', { name: 'Ankara, Türkiye' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(days)
    expect(screen.getByText(/24[.,]5 °C/)).toBeInTheDocument()
    const call = fetchMock.mock.calls.find(([input]) =>
      input.toString().includes('/api/weather/external/forecast?'),
    )
    expect(call?.[0].toString()).toContain(`city=Ankara&days=${days}`)
  })

  it.each([
    ['', 'City is required.'],
    ['A', 'City must contain at least 2 characters.'],
    ['A'.repeat(101), 'City must be 100 characters or fewer.'],
  ])('blocks invalid city input', async (value, message) => {
    const { fetchMock, user } = await enterLivePage(successfulFetch)
    const city = screen.getByLabelText('City')
    await user.clear(city)
    if (value) fireEvent.change(city, { target: { value } })
    await user.click(screen.getByRole('button', { name: 'Get live forecast' }))

    expect(screen.getByRole('alert')).toHaveTextContent(message)
    expect(city).toHaveFocus()
    expect(
      fetchMock.mock.calls.some(([input]) =>
        input.toString().includes('/api/weather/external/forecast?'),
      ),
    ).toBe(false)
  })

  it('prevents synchronous duplicate submissions', async () => {
    let resolveForecast: ((value: Response) => void) | undefined
    const { fetchMock, user } = await enterLivePage((input) => {
      if (input.toString().includes('/api/weather/external/forecast?')) {
        return new Promise<Response>((resolve) => {
          resolveForecast = resolve
        })
      }
      return successfulFetch(input)
    })
    const form = screen.getByRole('button', { name: 'Get live forecast' }).closest('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(
      fetchMock.mock.calls.filter(([input]) =>
        input.toString().includes('/api/weather/external/forecast?'),
      ),
    ).toHaveLength(1)
    expect(screen.getByRole('button', { name: /loading live forecast/i })).toBeInTheDocument()
    resolveForecast?.(new Response(JSON.stringify(forecast()), { status: 200 }))
    expect(await screen.findByRole('heading', { name: 'Ankara, Türkiye' })).toBeInTheDocument()
    void user
  })

  it('lets a newer distinct request win over an older delayed response', async () => {
    let resolveOlder: ((value: Response) => void) | undefined
    const { user } = await enterLivePage((input) => {
      const url = input.toString()
      if (url.includes('city=Istanbul')) {
        return new Promise<Response>((resolve) => {
          resolveOlder = resolve
        })
      }
      if (url.includes('city=Ankara')) return response(forecast('Ankara', 1))
      return successfulFetch(input)
    })

    await user.selectOptions(screen.getByLabelText('Forecast length'), '1')
    await user.click(screen.getByRole('button', { name: 'Get live forecast' }))
    const city = screen.getByLabelText('City')
    await user.clear(city)
    await user.type(city, 'Ankara')
    await user.click(screen.getByRole('button', { name: /loading live forecast/i }))
    expect(
      await screen.findByRole('heading', { name: 'Ankara, Türkiye' }),
    ).toBeInTheDocument()

    resolveOlder?.(
      new Response(JSON.stringify(forecast('Istanbul', 1)), { status: 200 }),
    )
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Ankara, Türkiye' }),
      ).toBeInTheDocument(),
    )
    expect(
      screen.queryByRole('heading', { name: 'Istanbul, Türkiye' }),
    ).not.toBeInTheDocument()
  })

  it.each([
    [400, /check the city and forecast length/i],
    [404, /city could not be found/i],
    [429, /request limit has been reached/i],
    [500, /temporarily unavailable/i],
    [503, /provider is unavailable/i],
  ])('shows a safe message for status %s and preserves confirmed data', async (status, message) => {
    let attempts = 0
    const { user } = await enterLivePage((input) => {
      if (input.toString().includes('/api/weather/external/forecast?')) {
        attempts += 1
        return attempts === 1 ? response(forecast()) : response({ detail: 'secret' }, status)
      }
      return successfulFetch(input)
    })
    await user.click(screen.getByRole('button', { name: 'Get live forecast' }))
    await screen.findByRole('heading', { name: 'Ankara, Türkiye' })
    await user.click(screen.getByRole('button', { name: 'Get live forecast' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.getByRole('heading', { name: 'Ankara, Türkiye' })).toBeInTheDocument()
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
  })

  it('handles network and malformed successful responses safely', async () => {
    let attempts = 0
    const { user } = await enterLivePage((input) => {
      if (input.toString().includes('/api/weather/external/forecast?')) {
        attempts += 1
        return attempts === 1
          ? Promise.reject(new Error('internal network detail'))
          : response({ ...forecast(), days: [{ invalid: true }] })
      }
      return successfulFetch(input)
    })
    await user.click(screen.getByRole('button', { name: 'Get live forecast' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be loaded/i)
    expect(screen.queryByText(/internal network detail/i)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Get live forecast' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be loaded/i)
  })

  it('logs out through the existing flow on 401', async () => {
    const { user } = await enterLivePage((input) =>
      input.toString().includes('/api/weather/external/forecast?')
        ? response({}, 401)
        : successfulFetch(input),
    )
    await user.click(screen.getByRole('button', { name: 'Get live forecast' }))
    expect(
      await screen.findByRole('heading', { name: /sign in to your account/i }),
    ).toBeInTheDocument()
  })

  it('does not update state after unmount during a request', async () => {
    let resolveForecast: ((value: Response) => void) | undefined
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { user } = await enterLivePage((input) => {
      if (input.toString().includes('/api/weather/external/forecast?')) {
        return new Promise<Response>((resolve) => {
          resolveForecast = resolve
        })
      }
      return successfulFetch(input)
    })
    await user.click(screen.getByRole('button', { name: 'Get live forecast' }))
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    resolveForecast?.(new Response(JSON.stringify(forecast()), { status: 200 }))
    await waitFor(() => expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument())
    expect(consoleError).not.toHaveBeenCalled()
  })
})
