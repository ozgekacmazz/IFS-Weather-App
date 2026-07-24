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

function current(city = 'Istanbul', recommendations: unknown[] = []) {
  return {
    weatherId: 10,
    weatherDate: '2026-07-23',
    cityName: city,
    temperature: 24.5,
    mainStatus: 'Partly cloudy',
    updatedAt: '2026-07-23T08:00:00Z',
    recommendations,
  }
}

function forecast(city = 'Istanbul', items: unknown[] = [
  { ...current(city), weatherId: 12, weatherDate: '2026-07-25', temperature: 27 },
  { ...current(city), weatherId: 11, weatherDate: '2026-07-21', temperature: 20 },
]) {
  return {
    cityName: city,
    startDate: '2026-07-20',
    requestedDays: 7,
    items,
  }
}

function jsonResponse(value: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(value), { status }),
  )
}

async function enterDashboard(
  fetchImplementation: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
) {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(
    fetchImplementation,
  )
  const user = userEvent.setup()

  const view = render(
    <MemoryRouter initialEntries={['/login']}>
      <App apiBaseUrl={apiBaseUrl} />
    </MemoryRouter>,
  )

  await user.type(screen.getByLabelText(/username or email/i), 'test.user')
  await user.type(screen.getByLabelText(/^password$/i), 'TestPass1')
  await user.click(screen.getByRole('button', { name: /^sign in$/i }))
  await screen.findByRole('heading', { name: /your weather, at a glance/i })

  return { fetchMock, user, view }
}

function successfulDashboardFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const url = input.toString()

  if (url.endsWith('/api/auth/login')) {
    return jsonResponse(authentication)
  }

  if (url.endsWith('/api/profile') && init?.method === 'PUT') {
    return jsonResponse(profile('Ankara'))
  }

  if (url.endsWith('/api/profile')) {
    return jsonResponse(profile())
  }

  if (url.endsWith('/api/weather/today')) {
    return jsonResponse(current())
  }

  return jsonResponse(forecast())
}

describe('UserWeatherDashboardPage', () => {
  it('renders authenticated current and ordered weekly weather data', async () => {
    const { fetchMock } = await enterDashboard(successfulDashboardFetch)

    expect(await screen.findByRole('heading', { name: 'Istanbul' })).toBeInTheDocument()
    expect(document.querySelector('.current-temperature'))
      .toHaveTextContent(/24[.,]5°C/)
    expect(screen.getByText(/last updated/i)).toBeInTheDocument()
    expect(
      document.querySelector('time[datetime="2026-07-23T08:00:00Z"]'),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Partly cloudy')).not.toHaveLength(0)
    expect(
      screen.getByRole('img', { name: /weekly temperature trend/i }),
    ).toBeInTheDocument()
    const dailyValues = screen.getAllByRole('listitem')
    expect(dailyValues[0]).toHaveTextContent('20')
    expect(dailyValues[1]).toHaveTextContent('27')

    const authenticatedCalls = fetchMock.mock.calls.slice(1)
    expect(authenticatedCalls).toHaveLength(3)
    authenticatedCalls.forEach(([, options]) => {
      expect(new Headers(options?.headers).get('Authorization')).toBe(
        'Bearer test-access-token',
      )
    })
  })

  it('renders Today recommendations with category, content, and priority', async () => {
    await enterDashboard((input, init) => {
      if (input.toString().endsWith('/api/weather/today')) {
        return jsonResponse(current('Istanbul', [
          {
            category: 'Health',
            title: 'Prioritize hydration',
            message: 'Drink water regularly and take breaks in a cool place.',
            priority: 'Important',
            iconKey: 'hydration',
          },
          {
            category: 'Agriculture',
            title: 'Avoid midday watering',
            message: 'Water plants early or late in the day.',
            priority: 'Warning',
            iconKey: 'plant',
          },
        ]))
      }

      return successfulDashboardFetch(input, init)
    })

    expect(
      await screen.findByRole('heading', { name: 'Weather recommendations' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Health')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Prioritize hydration' }))
      .toBeInTheDocument()
    expect(screen.getByText(/drink water regularly/i)).toBeInTheDocument()
    expect(screen.getByText('Important')).toBeInTheDocument()
    expect(screen.getByText('Agriculture')).toBeInTheDocument()
    expect(screen.getByText('Warning')).toBeInTheDocument()
  })

  it('does not render a recommendations section for an empty collection', async () => {
    await enterDashboard(successfulDashboardFetch)

    expect(await screen.findByRole('heading', { name: 'Istanbul' }))
      .toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Weather recommendations' }),
    ).not.toBeInTheDocument()
  })

  it('shows an intentional loading state while profile data is pending', async () => {
    let resolveProfile: ((response: Response) => void) | undefined
    const implementation = (input: RequestInfo | URL) => {
      const url = input.toString()

      if (url.endsWith('/api/auth/login')) {
        return jsonResponse(authentication)
      }

      if (url.endsWith('/api/profile')) {
        return new Promise<Response>((resolve) => {
          resolveProfile = resolve
        })
      }

      return successfulDashboardFetch(input)
    }
    await enterDashboard(implementation)

    expect(screen.getByText('Loading your dashboard…')).toBeInTheDocument()
    await waitFor(() => expect(resolveProfile).toBeTypeOf('function'))
    resolveProfile?.(new Response(JSON.stringify(profile()), { status: 200 }))
    expect(
      await screen.findByRole('heading', { name: 'Istanbul' }),
    ).toBeInTheDocument()
  })

  it('keeps stable current and forecast placeholders while weather loads', async () => {
    let resolveCurrent: ((response: Response) => void) | undefined
    let resolveForecast: ((response: Response) => void) | undefined
    await enterDashboard((input, init) => {
      const url = input.toString()
      if (url.endsWith('/api/weather/today')) {
        return new Promise<Response>((resolve) => {
          resolveCurrent = resolve
        })
      }
      if (url.endsWith('/api/weather/forecast')) {
        return new Promise<Response>((resolve) => {
          resolveForecast = resolve
        })
      }
      return successfulDashboardFetch(input, init)
    })

    expect(
      await screen.findByRole('status', { name: 'Loading current weather' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('status', { name: 'Loading weekly forecast' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Weather recommendations' }),
    ).not.toBeInTheDocument()

    resolveCurrent?.(new Response(JSON.stringify(current()), { status: 200 }))
    resolveForecast?.(new Response(JSON.stringify(forecast()), { status: 200 }))
    await waitFor(() => {
      expect(document.querySelector('.current-temperature'))
        .toHaveTextContent(/24[.,]5°C/)
    })
  })

  it('distinguishes an empty weekly forecast from a request failure', async () => {
    await enterDashboard((input, init) => {
      const url = input.toString()

      if (url.endsWith('/api/weather/forecast')) {
        return jsonResponse(forecast('Istanbul', []))
      }

      return successfulDashboardFetch(input, init)
    })

    expect(
      await screen.findByText(/no forecast records are available/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText('No weekly forecast saved').closest('[role="status"]'),
    ).toBeInTheDocument()
  })

  it('rejects malformed successful weather data safely', async () => {
    await enterDashboard((input, init) => {
      const url = input.toString()

      if (url.endsWith('/api/weather/today')) {
        return jsonResponse({ ...current(), temperature: 'not-a-number' })
      }

      return successfulDashboardFetch(input, init)
    })

    expect(
      await screen.findByText(/weather information is temporarily unavailable/i),
    ).toBeInTheDocument()
    expect(screen.getByText('Current weather unavailable').closest('[role="alert"]'))
      .toBeInTheDocument()
    expect(screen.queryByText('not-a-number')).not.toBeInTheDocument()
  })

  it('rejects a malformed recommendation response safely', async () => {
    await enterDashboard((input, init) => {
      if (input.toString().endsWith('/api/weather/today')) {
        return jsonResponse(current('Istanbul', [
          {
            category: 'Unknown',
            title: 'Unsafe recommendation',
            message: 'This should not render.',
            priority: 'Critical',
            iconKey: '',
          },
        ]))
      }

      return successfulDashboardFetch(input, init)
    })

    expect(
      await screen.findByText(/weather information is temporarily unavailable/i),
    ).toBeInTheDocument()
    expect(screen.getByText('Current weather unavailable').closest('[role="alert"]'))
      .toBeInTheDocument()
    expect(screen.queryByText('Unsafe recommendation')).not.toBeInTheDocument()
  })

  it('rejects a blank city without sending an update request', async () => {
    const { fetchMock, user } = await enterDashboard(successfulDashboardFetch)
    const input = await screen.findByLabelText('Default city')
    await waitFor(() => expect(input).toBeEnabled())
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: 'Update city' }))

    expect(
      screen.getByText('City is required.'),
    ).toBeInTheDocument()
    expect(
      fetchMock.mock.calls.filter(([, options]) => options?.method === 'PUT'),
    ).toHaveLength(0)
  })

  it('enforces the profile city maximum and prevents duplicate updates', async () => {
    let resolveUpdate: ((response: Response) => void) | undefined
    const { fetchMock, user } = await enterDashboard((input, init) => {
      const url = input.toString()

      if (url.endsWith('/api/profile') && init?.method === 'PUT') {
        return new Promise<Response>((resolve) => {
          resolveUpdate = resolve
        })
      }

      return successfulDashboardFetch(input, init)
    })
    const cityInput = await screen.findByLabelText('Default city')
    await waitFor(() => expect(cityInput).toBeEnabled())
    await user.clear(cityInput)
    await user.type(cityInput, 'x'.repeat(101))
    await user.click(screen.getByRole('button', { name: 'Update city' }))
    expect(
      screen.getByText('City must contain no more than 100 characters.'),
    ).toBeInTheDocument()
    expect(
      fetchMock.mock.calls.filter(([, options]) => options?.method === 'PUT'),
    ).toHaveLength(0)

    await user.clear(cityInput)
    await user.type(cityInput, 'Ankara')
    await user.dblClick(screen.getByRole('button', { name: 'Update city' }))
    expect(
      fetchMock.mock.calls.filter(([, options]) => options?.method === 'PUT'),
    ).toHaveLength(1)
    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled()

    resolveUpdate?.(
      new Response(JSON.stringify(profile('Ankara')), { status: 200 }),
    )
    expect(
      await screen.findByText(/default city updated and weather information refreshed/i),
    ).toBeInTheDocument()
  })

  it('accepts and submits a trimmed one-character city', async () => {
    const { fetchMock, user } = await enterDashboard((input, init) => {
      const url = input.toString()

      if (url.endsWith('/api/profile') && init?.method === 'PUT') {
        return jsonResponse(profile('X'))
      }

      if (url.endsWith('/api/weather/today')) {
        return jsonResponse(current('X'))
      }

      if (url.endsWith('/api/weather/forecast')) {
        return jsonResponse(forecast('X'))
      }

      return successfulDashboardFetch(input, init)
    })
    const cityInput = await screen.findByLabelText('Default city')
    await waitFor(() => expect(cityInput).toBeEnabled())
    await user.clear(cityInput)
    await user.type(cityInput, ' X ')
    await user.click(screen.getByRole('button', { name: 'Update city' }))

    expect(
      await screen.findByRole('heading', { name: 'X' }),
    ).toBeInTheDocument()
    const updateCall = fetchMock.mock.calls.find(
      ([input, options]) =>
        input.toString().endsWith('/api/profile') && options?.method === 'PUT',
    )
    expect(JSON.parse(String(updateCall?.[1]?.body)).defaultCity).toBe('X')
  })

  it('labels current and forecast data with their returned city names', async () => {
    await enterDashboard((input, init) => {
      const url = input.toString()

      if (url.endsWith('/api/weather/today')) {
        return jsonResponse(current('Ankara'))
      }

      if (url.endsWith('/api/weather/forecast')) {
        return jsonResponse(forecast('Izmir'))
      }

      return successfulDashboardFetch(input, init)
    })

    expect(
      await screen.findByRole('heading', { name: 'Ankara' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Temperature trend for Izmir' }),
    ).toBeInTheDocument()
  })

  it('keeps Retry from invalidating a pending confirmed profile mutation', async () => {
    let resolveUpdate: ((response: Response) => void) | undefined
    let updateStarted = false
    const { fetchMock, user } = await enterDashboard((input, init) => {
      const url = input.toString()

      if (url.endsWith('/api/profile') && init?.method === 'PUT') {
        updateStarted = true
        return new Promise<Response>((resolve) => {
          resolveUpdate = resolve
        })
      }

      if (url.endsWith('/api/weather/today')) {
        return updateStarted
          ? jsonResponse(current('Ankara'))
          : jsonResponse({ status: 404 }, 404)
      }

      if (url.endsWith('/api/weather/forecast')) {
        return updateStarted
          ? jsonResponse(forecast('Ankara'))
          : jsonResponse(forecast())
      }

      return successfulDashboardFetch(input, init)
    })
    const retryButton = await screen.findByRole('button', { name: 'Retry' })
    const cityInput = screen.getByLabelText('Default city')
    await user.clear(cityInput)
    await user.type(cityInput, 'Ankara')
    await user.click(screen.getByRole('button', { name: 'Update city' }))

    expect(retryButton).toBeDisabled()
    await user.click(retryButton)
    expect(
      fetchMock.mock.calls.filter(
        ([input, options]) =>
          input.toString().endsWith('/api/profile') && options?.method === 'GET',
      ),
    ).toHaveLength(1)

    resolveUpdate?.(
      new Response(JSON.stringify(profile('Ankara')), { status: 200 }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Ankara' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        name: 'Temperature trend for Ankara',
      }),
    ).toBeInTheDocument()
  })

  it('does not let stale weather overwrite a newer confirmed city flow', async () => {
    let resolveOldCurrent: ((response: Response) => void) | undefined
    let resolveOldForecast: ((response: Response) => void) | undefined
    let weatherGeneration = 0
    await enterDashboard((input, init) => {
      const url = input.toString()

      if (url.endsWith('/api/profile') && init?.method === 'PUT') {
        return jsonResponse(profile('Ankara'))
      }

      if (url.endsWith('/api/weather/today')) {
        weatherGeneration += 1
        if (weatherGeneration === 1) {
          return new Promise<Response>((resolve) => {
            resolveOldCurrent = resolve
          })
        }

        return jsonResponse(current('Ankara'))
      }

      if (url.endsWith('/api/weather/forecast')) {
        if (weatherGeneration === 1) {
          return new Promise<Response>((resolve) => {
            resolveOldForecast = resolve
          })
        }

        return jsonResponse(forecast('Ankara'))
      }

      return successfulDashboardFetch(input, init)
    })
    const cityInput = screen.getByLabelText('Default city')
    await waitFor(() => {
      expect(cityInput).toHaveValue('Istanbul')
      expect(resolveOldCurrent).toBeTypeOf('function')
      expect(resolveOldForecast).toBeTypeOf('function')
    })

    fireEvent.change(cityInput, { target: { value: 'Ankara' } })
    fireEvent.submit(cityInput.closest('form')!)

    expect(
      await screen.findByRole('heading', { name: 'Ankara' }),
    ).toBeInTheDocument()
    resolveOldCurrent?.(
      new Response(JSON.stringify(current('Istanbul')), { status: 200 }),
    )
    resolveOldForecast?.(
      new Response(JSON.stringify(forecast('Istanbul')), { status: 200 }),
    )

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Ankara' }),
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('heading', { name: 'Istanbul' }),
      ).not.toBeInTheDocument()
    })
  })

  it('logs out when the dashboard profile request returns 401', async () => {
    await enterDashboard((input, init) => {
      if (input.toString().endsWith('/api/profile')) {
        return jsonResponse({ status: 401 }, 401)
      }

      return successfulDashboardFetch(input, init)
    })

    expect(
      await screen.findByRole('heading', { name: /sign in to your account/i }),
    ).toBeInTheDocument()
  })

  it('shows the current-weather 404 state and recovers on Retry', async () => {
    let currentRequests = 0
    const { user } = await enterDashboard((input, init) => {
      const url = input.toString()

      if (url.endsWith('/api/weather/today')) {
        currentRequests += 1
        return currentRequests === 1
          ? jsonResponse({ status: 404 }, 404)
          : jsonResponse(current())
      }

      return successfulDashboardFetch(input, init)
    })

    expect(
      await screen.findByText(/no current weather record is available/i),
    ).toBeInTheDocument()
    expect(screen.getByText('No weather saved for today').closest('[role="status"]'))
      .toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText(/24[.,]5/)).toBeInTheDocument()
    expect(currentRequests).toBe(2)
  })

  it('refreshes only weather data without reloading the profile', async () => {
    let currentRequests = 0
    let forecastRequests = 0
    const { fetchMock, user } = await enterDashboard((input, init) => {
      const url = input.toString()
      if (url.endsWith('/api/weather/today')) {
        currentRequests += 1
        return jsonResponse(current())
      }
      if (url.endsWith('/api/weather/forecast')) {
        forecastRequests += 1
        return jsonResponse(forecast())
      }
      return successfulDashboardFetch(input, init)
    })

    await waitFor(() => {
      expect(document.querySelector('.current-temperature'))
        .toHaveTextContent(/24[.,]5°C/)
    })
    await user.click(screen.getByRole('button', { name: 'Refresh weather' }))

    expect(
      await screen.findByText('Weather information refreshed.'),
    ).toBeInTheDocument()
    expect(currentRequests).toBe(2)
    expect(forecastRequests).toBe(2)
    expect(
      fetchMock.mock.calls.filter(
        ([input, options]) =>
          input.toString().endsWith('/api/profile') &&
          options?.method !== 'PUT',
      ),
    ).toHaveLength(1)
  })

  it('can unmount safely while the profile request is pending', async () => {
    let resolveProfile: ((response: Response) => void) | undefined
    const { view } = await enterDashboard((input, init) => {
      const url = input.toString()

      if (url.endsWith('/api/profile')) {
        return new Promise<Response>((resolve) => {
          resolveProfile = resolve
        })
      }

      return successfulDashboardFetch(input, init)
    })

    await waitFor(() => expect(resolveProfile).toBeTypeOf('function'))
    view.unmount()
    resolveProfile?.(
      new Response(JSON.stringify(profile('Stale city')), { status: 200 }),
    )
    await Promise.resolve()
    await Promise.resolve()
  })

  it('trims a saved city and refreshes weather after backend confirmation', async () => {
    let confirmedCity = 'Istanbul'
    const { fetchMock, user } = await enterDashboard((input, init) => {
      const url = input.toString()

      if (url.endsWith('/api/auth/login')) {
        return jsonResponse(authentication)
      }

      if (url.endsWith('/api/profile') && init?.method === 'PUT') {
        confirmedCity = 'Ankara'
        return jsonResponse(profile(confirmedCity))
      }

      if (url.endsWith('/api/profile')) {
        return jsonResponse(profile(confirmedCity))
      }

      if (url.endsWith('/api/weather/today')) {
        return jsonResponse(current(confirmedCity))
      }

      return jsonResponse(forecast(confirmedCity))
    })
    const cityInput = await screen.findByLabelText('Default city')
    await waitFor(() => expect(cityInput).toBeEnabled())
    await user.clear(cityInput)
    await user.type(cityInput, '  Ankara  ')
    await user.click(screen.getByRole('button', { name: 'Update city' }))

    expect(
      await screen.findByText(/default city updated and weather information refreshed/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ankara' })).toBeInTheDocument()

    const updateCall = fetchMock.mock.calls.find(
      ([input, options]) =>
        input.toString().endsWith('/api/profile') && options?.method === 'PUT',
    )
    expect(JSON.parse(String(updateCall?.[1]?.body))).toMatchObject({
      firstName: 'Test',
      lastName: 'User',
      defaultCity: 'Ankara',
      currentPassword: null,
      newPassword: null,
    })
    expect(
      fetchMock.mock.calls.filter(([input]) =>
        input.toString().endsWith('/api/weather/today'),
      ),
    ).toHaveLength(2)
  })

  it('keeps the confirmed city and reports a refresh failure honestly', async () => {
    let updateCompleted = false
    const { user } = await enterDashboard((input, init) => {
      const url = input.toString()

      if (url.endsWith('/api/auth/login')) {
        return jsonResponse(authentication)
      }

      if (url.endsWith('/api/profile') && init?.method === 'PUT') {
        updateCompleted = true
        return jsonResponse(profile('Ankara'))
      }

      if (url.endsWith('/api/profile')) {
        return jsonResponse(profile())
      }

      if (updateCompleted && url.includes('/api/weather/')) {
        return jsonResponse({ status: 503 }, 503)
      }

      return url.endsWith('/api/weather/today')
        ? jsonResponse(current())
        : jsonResponse(forecast())
    })
    const cityInput = await screen.findByLabelText('Default city')
    await waitFor(() => expect(cityInput).toBeEnabled())
    await user.clear(cityInput)
    await user.type(cityInput, 'Ankara')
    await user.click(screen.getByRole('button', { name: 'Update city' }))

    expect(
      await screen.findByText(/default city updated, but some weather information/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ankara' })).toBeInTheDocument()
  })

  it('does not replace the confirmed city when the update fails', async () => {
    const { user } = await enterDashboard((input, init) => {
      const url = input.toString()

      if (url.endsWith('/api/profile') && init?.method === 'PUT') {
        return jsonResponse({ status: 400 }, 400)
      }

      return successfulDashboardFetch(input, init)
    })
    const cityInput = await screen.findByLabelText('Default city')
    await waitFor(() => expect(cityInput).toBeEnabled())
    await user.clear(cityInput)
    await user.type(cityInput, 'Ankara')
    await user.click(screen.getByRole('button', { name: 'Update city' }))

    expect(
      await screen.findByText(/default city could not be updated/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Istanbul' })).toBeInTheDocument()
  })

  it('supports a profile with no default city without inventing weather data', async () => {
    const { fetchMock } = await enterDashboard((input, init) => {
      const url = input.toString()

      if (url.endsWith('/api/profile') && init?.method !== 'PUT') {
        return jsonResponse(profile(null))
      }

      return successfulDashboardFetch(input, init)
    })

    expect(
      await screen.findByRole('heading', { name: /choose your default city/i }),
    ).toBeInTheDocument()
    expect(
      fetchMock.mock.calls.some(([input]) =>
        input.toString().includes('/api/weather/'),
      ),
    ).toBe(false)
  })
})
