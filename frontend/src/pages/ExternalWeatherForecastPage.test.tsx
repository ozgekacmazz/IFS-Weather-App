import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
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

const aydin = {
  providerLocationId: 42,
  name: 'Aydın',
  region: 'Aydin',
  country: 'Türkiye',
  latitude: 37.8450123456789,
  longitude: 27.839987654321,
  displayLabel: 'Aydın, Aydin, Türkiye',
}

const aydinOhio = {
  providerLocationId: 84,
  name: 'Aydın',
  region: 'Ohio',
  country: 'United States',
  latitude: 40.123456,
  longitude: -82.654321,
  displayLabel: 'Aydın, Ohio, United States',
}

const izmir = {
  providerLocationId: 43,
  name: 'İzmir',
  region: 'Izmir',
  country: 'Türkiye',
  latitude: 38.423734,
  longitude: 27.142826,
  displayLabel: 'İzmir, Izmir, Türkiye',
}

const diyarbakir = {
  providerLocationId: 45,
  name: 'Diyarbakir',
  region: 'Diyarbakir',
  country: 'Turkey',
  latitude: 37.91441,
  longitude: 40.23063,
  displayLabel: 'Diyarbakir, Diyarbakir, Turkey',
}

const denizli = {
  providerLocationId: 44,
  name: 'Denizli',
  region: 'Denizli',
  country: 'Turkey',
  latitude: 37.77652,
  longitude: 29.08639,
  displayLabel: 'Denizli, Denizli, Turkey',
}

function profile(defaultCity: string | null = null) {
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

function forecast(city = 'Aydın', count = 3) {
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
        averageHumidity: 64,
        maximumWindSpeedKph: 22.5,
        precipitationProbability: 5,
        mainStatus: 'Sunny',
        iconUrl: '//cdn.weatherapi.com/day.png',
      },
      {
        date: '2026-07-24',
        minimumTemperature: 17,
        maximumTemperature: 29,
        averageTemperature: 23,
        averageHumidity: 70,
        maximumWindSpeedKph: 18,
        precipitationProbability: 20,
        mainStatus: 'Partly cloudy',
        iconUrl: null,
      },
      {
        date: '2026-07-25',
        minimumTemperature: 16,
        maximumTemperature: 26,
        averageTemperature: 21,
        averageHumidity: 82,
        maximumWindSpeedKph: 35,
        precipitationProbability: 90,
        mainStatus: 'Rain',
        iconUrl: null,
      },
    ].slice(0, count),
  }
}

function response(value: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(value), { status }))
}

function baseFetch(
  input: RequestInfo | URL,
  defaultCity: string | null = null,
) {
  const url = input.toString()
  if (url.endsWith('/api/auth/login')) return response(authentication)
  if (url.endsWith('/api/profile')) return response(profile(defaultCity))
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
  if (url.endsWith('/api/weather/forecast')) {
    return response({
      cityName: 'Istanbul',
      startDate: '2026-07-20',
      requestedDays: 7,
      items: [],
    })
  }
  if (url.includes('/api/weather/external/locations?')) {
    return response([aydin, aydinOhio])
  }
  if (url.includes('/api/weather/external/forecast/coordinates?')) {
    return response(forecast())
  }
  throw new Error(`Unexpected test request: ${url}`)
}

async function enterLivePage(
  implementation: (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => Promise<Response> = (input) => baseFetch(input),
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

async function searchFor(
  user: ReturnType<typeof userEvent.setup>,
  value: string,
) {
  const input = screen.getByRole('combobox', { name: 'Location' })
  await user.clear(input)
  await user.type(input, value)
  return input
}

async function selectLocation(
  user: ReturnType<typeof userEvent.setup>,
  query = 'Aydın',
  label = aydin.displayLabel,
) {
  const input = await searchFor(user, query)
  const option = await screen.findByRole('option', { name: label })
  await user.click(option)
  return input
}

function callsFor(fetchMock: ReturnType<typeof vi.spyOn>, fragment: string) {
  return fetchMock.mock.calls.filter((call: [RequestInfo | URL, RequestInit?]) =>
    String(call[0]).includes(fragment),
  )
}

describe('ExternalWeatherForecastPage', () => {
  it('prefills the saved city for search without requesting a forecast', async () => {
    const { fetchMock } = await enterLivePage((input) =>
      baseFetch(input, 'İzmir'),
    )

    expect(await screen.findByRole('combobox', { name: 'Location' })).toHaveValue(
      'İzmir',
    )
    expect(screen.getByText(/no live forecast request is made/i)).toBeInTheDocument()
    expect(callsFor(fetchMock, '/forecast/coordinates?')).toHaveLength(0)
  })

  it('does not search empty, whitespace-only, or one-character input', async () => {
    const { fetchMock, user } = await enterLivePage()
    const input = screen.getByRole('combobox', { name: 'Location' })

    await user.type(input, ' ')
    await user.clear(input)
    await user.type(input, 'A')
    await new Promise((resolve) => window.setTimeout(resolve, 450))

    expect(callsFor(fetchMock, '/locations?')).toHaveLength(0)
  })

  it('debounces Unicode search, shows loading, and preserves provider order', async () => {
    let resolveSearch: ((value: Response) => void) | undefined
    const { fetchMock, user } = await enterLivePage((input) => {
      if (input.toString().includes('/locations?')) {
        return new Promise<Response>((resolve) => {
          resolveSearch = resolve
        })
      }
      return baseFetch(input)
    })

    await searchFor(user, 'Aydın')
    expect(callsFor(fetchMock, '/locations?')).toHaveLength(0)
    expect(await screen.findByText('Searching locations…')).toBeInTheDocument()

    resolveSearch?.(
      new Response(JSON.stringify([aydin, aydinOhio]), { status: 200 }),
    )
    const listbox = await screen.findByRole('listbox')
    const options = await within(listbox).findAllByRole(
      'option',
    )
    expect(options.map((option) => option.textContent)).toEqual([
      aydin.displayLabel,
      aydinOhio.displayLabel,
    ])
    const searchUrl = callsFor(fetchMock, '/locations?')[0][0].toString()
    expect(searchUrl).toContain('query=Ayd%C4%B1n')
  })

  it('distinguishes no results from a search failure', async () => {
    let attempts = 0
    const { user } = await enterLivePage((input) => {
      if (input.toString().includes('/locations?')) {
        attempts += 1
        return attempts === 1 ? response([]) : response({ detail: 'secret' }, 503)
      }
      return baseFetch(input)
    })

    await searchFor(user, 'Missing')
    expect(await screen.findByText('No matching locations found.')).toBeInTheDocument()
    await searchFor(user, 'München')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /location search failed/i,
    )
    expect(screen.queryByText('No matching locations found.')).not.toBeInTheDocument()
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
  })

  it('prevents an older search response from replacing newer results', async () => {
    let resolveOlder: ((value: Response) => void) | undefined
    const { fetchMock, user } = await enterLivePage((input) => {
      const url = input.toString()
      if (url.includes('query=Ayd')) {
        return new Promise<Response>((resolve) => {
          resolveOlder = resolve
        })
      }
      if (url.includes('query=%C4%B0zmir')) return response([izmir])
      return baseFetch(input)
    })

    await searchFor(user, 'Aydın')
    await screen.findByText('Searching locations…')
    await searchFor(user, 'İzmir')
    expect(
      await screen.findByRole('option', { name: izmir.displayLabel }),
    ).toBeInTheDocument()
    const olderCall = callsFor(fetchMock, 'query=Ayd')[0]
    expect((olderCall[1]?.signal as AbortSignal).aborted).toBe(true)

    resolveOlder?.(new Response(JSON.stringify([aydin]), { status: 200 }))
    await waitFor(() =>
      expect(
        screen.getByRole('option', { name: izmir.displayLabel }),
      ).toBeInTheDocument(),
    )
    expect(
      screen.queryByRole('option', { name: aydin.displayLabel }),
    ).not.toBeInTheDocument()
  })

  it('uses the existing logout flow for a genuine current search 401', async () => {
    const { user } = await enterLivePage((input) =>
      input.toString().includes('/locations?')
        ? response({}, 401)
        : baseFetch(input),
    )

    await searchFor(user, 'Aydın')

    expect(
      await screen.findByRole('heading', { name: /sign in to your account/i }),
    ).toBeInTheDocument()
  })

  it('prevents an older search failure from replacing newer successful results', async () => {
    let rejectOlder: ((reason: unknown) => void) | undefined
    const { user } = await enterLivePage((input) => {
      const url = input.toString()
      if (url.includes('query=Ayd')) {
        return new Promise<Response>((_, reject) => {
          rejectOlder = reject
        })
      }
      if (url.includes('query=%C4%B0zmir')) return response([izmir])
      return baseFetch(input)
    })

    await searchFor(user, 'Aydın')
    await screen.findByText('Searching locations…')
    await searchFor(user, 'İzmir')
    expect(
      await screen.findByRole('option', { name: izmir.displayLabel }),
    ).toBeInTheDocument()

    rejectOlder?.(new Error('stale search failure'))
    await waitFor(() =>
      expect(
        screen.getByRole('option', { name: izmir.displayLabel }),
      ).toBeInTheDocument(),
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('supports Arrow navigation, Enter selection, and Escape dismissal', async () => {
    const { user } = await enterLivePage()
    const input = await searchFor(user, 'Aydın')
    await screen.findByRole('option', { name: aydin.displayLabel })

    expect(input).toHaveAttribute('aria-expanded', 'true')
    expect(input).toHaveAttribute('aria-autocomplete', 'list')
    expect(screen.getByRole('listbox')).toHaveAccessibleName(
      'Location suggestions',
    )

    await user.keyboard('{ArrowDown}{ArrowUp}{Enter}')
    expect(input).toHaveValue(aydin.displayLabel)
    expect(input).toHaveAttribute('aria-expanded', 'false')

    await user.type(input, 'x')
    await screen.findByRole('option', { name: aydin.displayLabel })
    await user.keyboard('{Escape}')
    expect(input).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('supports mouse selection and closes the dropdown', async () => {
    const { user } = await enterLivePage()
    const input = await selectLocation(user)

    expect(input).toHaveValue(aydin.displayLabel)
    expect(input).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByText(`Selected ${aydin.displayLabel}.`)).toBeInTheDocument()
  })

  it('closes results on outside interaction without changing the input', async () => {
    const { user } = await enterLivePage()
    const input = await searchFor(user, 'Aydın')
    await screen.findByRole('listbox')

    await user.click(
      screen.getByRole('heading', { name: 'Explore live weather anywhere.' }),
    )

    expect(input).toHaveValue('Aydın')
    expect(input).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it.each([1, 2, 3])(
    'uses selected coordinates and renders a valid %s-day forecast',
    async (days) => {
      const { fetchMock, user } = await enterLivePage((input) => {
        if (input.toString().includes('/forecast/coordinates?')) {
          return response(forecast('Aydın', days))
        }
        return baseFetch(input)
      })
      await selectLocation(user)
      await user.selectOptions(
        screen.getByLabelText('Forecast length'),
        String(days),
      )
      await user.click(screen.getByRole('button', { name: 'Get live forecast' }))

      expect(
        await screen.findByRole('heading', { name: aydin.displayLabel }),
      ).toBeInTheDocument()
      expect(screen.getAllByRole('listitem')).toHaveLength(days)
      expect(screen.getByText(/24[.,]5 °C/)).toBeInTheDocument()

      const forecastUrl = callsFor(fetchMock, '/forecast/coordinates?')[0][0]
        .toString()
      expect(forecastUrl).toContain(
        `latitude=${aydin.latitude}&longitude=${aydin.longitude}&days=${days}`,
      )
      expect(forecastUrl).not.toContain('city=')
      expect(callsFor(fetchMock, '/external/forecast?')).toHaveLength(0)
    },
  )

  it('removes duplicate location components while preserving coordinates', async () => {
    const { fetchMock, user } = await enterLivePage((input) => {
      const url = input.toString()
      if (url.includes('/locations?')) return response([denizli])
      if (url.includes('/forecast/coordinates?')) {
        return response(forecast('Basmahane'))
      }
      return baseFetch(input)
    })

    const input = await searchFor(user, 'Denizli')
    await user.click(await screen.findByRole('option', {
      name: 'Denizli, Turkey',
    }))
    expect(input).toHaveValue('Denizli, Turkey')

    await user.click(screen.getByRole('button', { name: 'Get live forecast' }))

    expect(
      await screen.findByRole('heading', { name: 'Denizli, Turkey' }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Denizli, Denizli, Turkey/)).not.toBeInTheDocument()
    expect(callsFor(fetchMock, '/forecast/coordinates?')[0][0].toString())
      .toContain(
        `latitude=${denizli.latitude}&longitude=${denizli.longitude}&days=3`,
      )
  })

  it.each([
    [izmir, 'Basmahane'],
    [diyarbakir, 'Amida'],
    [aydin, 'Aidin'],
  ])(
    'keeps selected location %s stable when the provider returns alias %s',
    async (selectedLocation, providerAlias) => {
      const { user } = await enterLivePage((input) => {
        if (input.toString().includes('/locations?')) {
          return response([selectedLocation])
        }
        if (input.toString().includes('/forecast/coordinates?')) {
          return response(forecast(providerAlias))
        }
        return baseFetch(input)
      })
      const expectedLabel =
        selectedLocation.name === selectedLocation.region
          ? `${selectedLocation.name}, ${selectedLocation.country}`
          : selectedLocation.displayLabel
      await searchFor(user, selectedLocation.name)
      await user.click(await screen.findByRole('option', {
        name: expectedLabel,
      }))
      await user.click(screen.getByRole('button', { name: 'Get live forecast' }))

      expect(
        await screen.findByRole('heading', { name: expectedLabel }),
      ).toBeInTheDocument()
      expect(screen.queryByRole('heading', {
        name: `${providerAlias}, TÃ¼rkiye`,
      })).not.toBeInTheDocument()
      expect(screen.getByText(
        `Live forecast loaded for ${expectedLabel}.`,
      )).toBeInTheDocument()
    },
  )

  it('requires a current structured selection before requesting a forecast', async () => {
    const { fetchMock, user } = await enterLivePage()
    const input = screen.getByRole('combobox', { name: 'Location' })

    await user.type(input, 'Aydın')
    await user.click(screen.getByRole('button', { name: 'Get live forecast' }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      /select a location from the suggestions/i,
    )
    expect(input).toHaveFocus()
    expect(callsFor(fetchMock, '/forecast/coordinates?')).toHaveLength(0)
  })

  it('invalidates selected coordinates immediately after editing', async () => {
    const { fetchMock, user } = await enterLivePage()
    const input = await selectLocation(user)

    await user.type(input, 'x')
    await user.click(screen.getByRole('button', { name: 'Get live forecast' }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      /select a location from the suggestions/i,
    )
    expect(callsFor(fetchMock, '/forecast/coordinates?')).toHaveLength(0)
  })

  it('clears a successful forecast immediately when input is edited or cleared', async () => {
    const { user } = await enterLivePage()
    const input = await selectLocation(user)
    await user.click(screen.getByRole('button', { name: 'Get live forecast' }))
    expect(
      await screen.findByRole('heading', { name: aydin.displayLabel }),
    ).toBeInTheDocument()

    await user.type(input, 'x')
    expect(
      screen.queryByRole('heading', { name: aydin.displayLabel }),
    ).not.toBeInTheDocument()

    await user.clear(input)
    expect(screen.getByText(/no live forecast request is made/i)).toBeInTheDocument()
  })

  it('clears an old forecast before a new empty or failed search completes', async () => {
    let searchAttempts = 0
    const { user } = await enterLivePage((input) => {
      const url = input.toString()
      if (url.includes('/locations?')) {
        searchAttempts += 1
        if (searchAttempts === 1) return response([aydin, aydinOhio])
        if (searchAttempts === 2) return response([])
        return response({ detail: 'provider secret' }, 503)
      }
      return baseFetch(input)
    })
    const input = await selectLocation(user)
    await user.click(screen.getByRole('button', { name: 'Get live forecast' }))
    await screen.findByRole('heading', { name: aydin.displayLabel })

    await user.clear(input)
    await user.type(input, 'Missing')
    expect(
      screen.queryByRole('heading', { name: aydin.displayLabel }),
    ).not.toBeInTheDocument()
    expect(await screen.findByText('No matching locations found.')).toBeInTheDocument()

    await user.clear(input)
    await user.type(input, 'München')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /location search failed/i,
    )
    expect(screen.queryByText('provider secret')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: aydin.displayLabel }),
    ).not.toBeInTheDocument()
  })

  it('selecting another same-named location invalidates the previous forecast', async () => {
    const { user } = await enterLivePage()
    const input = await selectLocation(user)
    await user.click(screen.getByRole('button', { name: 'Get live forecast' }))
    await screen.findByRole('heading', { name: aydin.displayLabel })

    await user.clear(input)
    await user.type(input, 'Aydın')
    await user.click(
      await screen.findByRole('option', { name: aydinOhio.displayLabel }),
    )

    expect(input).toHaveValue(aydinOhio.displayLabel)
    expect(
      screen.queryByRole('heading', { name: aydin.displayLabel }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(`Ready to retrieve weather for ${aydinOhio.displayLabel}.`),
    ).toBeInTheDocument()
  })

  it('aborts a pending forecast on input edit and ignores its later success', async () => {
    let resolveForecast: ((value: Response) => void) | undefined
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { fetchMock, user } = await enterLivePage((input) => {
      if (input.toString().includes('/forecast/coordinates?')) {
        return new Promise<Response>((resolve) => {
          resolveForecast = resolve
        })
      }
      return baseFetch(input)
    })
    const input = await selectLocation(user)
    await user.click(screen.getByRole('button', { name: 'Get live forecast' }))
    expect(
      await screen.findByRole('heading', { name: 'Loading live forecast' }),
    ).toBeInTheDocument()
    const forecastCall = callsFor(fetchMock, '/forecast/coordinates?')[0]

    await user.type(input, 'x')
    expect((forecastCall[1]?.signal as AbortSignal).aborted).toBe(true)
    expect(
      screen.queryByRole('heading', { name: 'Loading live forecast' }),
    ).not.toBeInTheDocument()

    resolveForecast?.(
      new Response(JSON.stringify(forecast('Stale Aydın')), { status: 200 }),
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: /Stale Aydın/ }),
      ).not.toBeInTheDocument(),
    )
    expect(screen.queryByText(/live forecast unavailable/i)).not.toBeInTheDocument()
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('aborts pending forecast transport and prevents updates after unmount', async () => {
    let resolveForecast: ((value: Response) => void) | undefined
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { fetchMock, user } = await enterLivePage((input) => {
      if (input.toString().includes('/forecast/coordinates?')) {
        return new Promise<Response>((resolve) => {
          resolveForecast = resolve
        })
      }
      return baseFetch(input)
    })
    await selectLocation(user)
    await user.click(screen.getByRole('button', { name: 'Get live forecast' }))
    const forecastCall = callsFor(fetchMock, '/forecast/coordinates?')[0]

    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect((forecastCall[1]?.signal as AbortSignal).aborted).toBe(true)
    resolveForecast?.(
      new Response(JSON.stringify(forecast('Unmounted stale result')), {
        status: 200,
      }),
    )

    expect(
      await screen.findByRole('heading', { name: /sign in to your account/i }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Unmounted stale result/)).not.toBeInTheDocument()
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('day changes abort pending work and bind the winning response to new days', async () => {
    let resolveOlder: ((value: Response) => void) | undefined
    let attempts = 0
    const { fetchMock, user } = await enterLivePage((input) => {
      if (input.toString().includes('/forecast/coordinates?')) {
        attempts += 1
        if (attempts === 1) {
          return new Promise<Response>((resolve) => {
            resolveOlder = resolve
          })
        }
        return response(forecast('Aydın', 1))
      }
      return baseFetch(input)
    })
    await selectLocation(user)
    await user.click(screen.getByRole('button', { name: 'Get live forecast' }))
    const olderCall = callsFor(fetchMock, '/forecast/coordinates?')[0]

    await user.selectOptions(screen.getByLabelText('Forecast length'), '1')
    expect((olderCall[1]?.signal as AbortSignal).aborted).toBe(true)
    expect(
      screen.queryByRole('heading', { name: 'Loading live forecast' }),
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Get live forecast' }))
    expect(
      await screen.findByRole('heading', { name: aydin.displayLabel }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)

    resolveOlder?.(
      new Response(JSON.stringify(forecast('Stale three-day', 3)), {
        status: 200,
      }),
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: /Stale three-day/ }),
      ).not.toBeInTheDocument(),
    )
    expect(callsFor(fetchMock, '/forecast/coordinates?')[1][0].toString())
      .toContain('days=1')
  })

  it('older forecast failure cannot replace a newer success or clear its loading state', async () => {
    let rejectOlder: ((reason: unknown) => void) | undefined
    let resolveNewer: ((value: Response) => void) | undefined
    let attempts = 0
    const { user } = await enterLivePage((input) => {
      if (input.toString().includes('/forecast/coordinates?')) {
        attempts += 1
        return attempts === 1
          ? new Promise<Response>((_, reject) => {
              rejectOlder = reject
            })
          : new Promise<Response>((resolve) => {
              resolveNewer = resolve
            })
      }
      return baseFetch(input)
    })
    await selectLocation(user)
    await user.click(screen.getByRole('button', { name: 'Get live forecast' }))
    await user.selectOptions(screen.getByLabelText('Forecast length'), '1')
    await user.click(screen.getByRole('button', { name: 'Get live forecast' }))

    rejectOlder?.(new Error('stale provider detail'))
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Loading live forecast' }),
      ).toBeInTheDocument(),
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    resolveNewer?.(
      new Response(JSON.stringify(forecast('Current Aydın', 1)), {
        status: 200,
      }),
    )
    expect(
      await screen.findByRole('heading', { name: aydin.displayLabel }),
    ).toBeInTheDocument()
    expect(screen.queryByText('stale provider detail')).not.toBeInTheDocument()
  })

  it('retries a recoverable failure with current selected coordinates and days', async () => {
    let attempts = 0
    const { fetchMock, user } = await enterLivePage((input) => {
      if (input.toString().includes('/forecast/coordinates?')) {
        attempts += 1
        return attempts === 1
          ? response({ detail: 'internal provider detail' }, 503)
          : response(forecast('Aydın', 2))
      }
      return baseFetch(input)
    })
    await selectLocation(user)
    await user.selectOptions(screen.getByLabelText('Forecast length'), '2')
    await user.click(screen.getByRole('button', { name: 'Get live forecast' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /provider is unavailable/i,
    )

    await user.click(screen.getByRole('button', { name: 'Retry forecast' }))
    expect(
      await screen.findByRole('heading', { name: aydin.displayLabel }),
    ).toBeInTheDocument()
    const retryUrl = callsFor(fetchMock, '/forecast/coordinates?')[1][0].toString()
    expect(retryUrl).toContain(
      `latitude=${aydin.latitude}&longitude=${aydin.longitude}&days=2`,
    )
    expect(retryUrl).not.toContain('city=')
    expect(screen.queryByText('internal provider detail')).not.toBeInTheDocument()
  })

  it('clearing below the search minimum aborts pending search without an error', async () => {
    const { fetchMock, user } = await enterLivePage((input) => {
      if (input.toString().includes('/locations?')) {
        return new Promise<Response>(() => undefined)
      }
      return baseFetch(input)
    })
    const input = await searchFor(user, 'Aydın')
    await screen.findByText('Searching locations…')
    const searchCall = callsFor(fetchMock, '/locations?')[0]

    await user.clear(input)
    await user.type(input, 'A')

    expect((searchCall[1]?.signal as AbortSignal).aborted).toBe(true)
    expect(input).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('prevents synchronous duplicate coordinate submissions', async () => {
    let resolveForecast: ((value: Response) => void) | undefined
    const { fetchMock, user } = await enterLivePage((input) => {
      if (input.toString().includes('/forecast/coordinates?')) {
        return new Promise<Response>((resolve) => {
          resolveForecast = resolve
        })
      }
      return baseFetch(input)
    })
    await selectLocation(user)
    const form = screen.getByRole('button', { name: 'Get live forecast' })
      .closest('form')!

    fireEvent.submit(form)
    fireEvent.submit(form)

    expect(callsFor(fetchMock, '/forecast/coordinates?')).toHaveLength(1)
    expect(
      screen.getByRole('button', { name: /loading live forecast/i }),
    ).toBeDisabled()
    resolveForecast?.(
      new Response(JSON.stringify(forecast()), { status: 200 }),
    )
    expect(
      await screen.findByRole('heading', { name: aydin.displayLabel }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Get live forecast' }),
    ).toBeEnabled()
  })

  it('shows safe forecast errors and logs out through the existing 401 flow', async () => {
    let forecastAttempts = 0
    const { user } = await enterLivePage((input) => {
      if (input.toString().includes('/forecast/coordinates?')) {
        forecastAttempts += 1
        return forecastAttempts === 1
          ? response({ detail: 'secret' }, 503)
          : response({}, 401)
      }
      return baseFetch(input)
    })
    await selectLocation(user)

    await user.click(screen.getByRole('button', { name: 'Get live forecast' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /provider is unavailable/i,
    )
    expect(screen.queryByText('secret')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Get live forecast' }))
    expect(
      await screen.findByRole('heading', { name: /sign in to your account/i }),
    ).toBeInTheDocument()
  })
})
