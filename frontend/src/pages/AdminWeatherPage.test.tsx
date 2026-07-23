import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { App } from '../App'

const apiBaseUrl = 'https://localhost:7257'
const authentication = {
  userId: 7,
  username: 'test.admin',
  email: 'admin@example.test',
  role: 2,
  accessToken: 'test-access-token',
  expiresAtUtc: '2099-07-22T12:00:00Z',
}

function weather(overrides: Record<string, unknown> = {}) {
  return {
    weatherId: 4,
    weatherDate: '2026-07-23',
    cityName: 'Denizli',
    temperature: 32.5,
    mainStatus: 'Clear',
    createdAt: '2026-07-23T08:00:00Z',
    updatedAt: '2026-07-23T09:00:00Z',
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

function json(value: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(value), { status }))
}

function deferredResponse() {
  let resolve!: (response: Response) => void
  const promise = new Promise<Response>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function successfulFetch(input: RequestInfo | URL, init?: RequestInit) {
  const url = input.toString()
  if (url.endsWith('/api/auth/login')) {
    return json(authentication)
  }
  if (init?.method === 'POST') {
    return json(weather(), 201)
  }
  if (init?.method === 'DELETE') {
    return Promise.resolve(new Response(null, { status: 204 }))
  }
  if (/\/api\/admin\/weather\/\d+$/.test(new URL(url).pathname)) {
    return json(weather())
  }
  return json(page())
}

async function enterWeather(
  implementation: (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => Promise<Response> = successfulFetch,
) {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(implementation)
  const user = userEvent.setup()
  const view = render(
    <MemoryRouter initialEntries={['/app/admin/weather']}>
      <App apiBaseUrl={apiBaseUrl} />
    </MemoryRouter>,
  )
  await user.type(screen.getByLabelText(/username or email/i), 'test.admin')
  await user.type(screen.getByLabelText(/^password$/i), 'TestPass1')
  await user.click(screen.getByRole('button', { name: /^sign in$/i }))
  await screen.findByRole('heading', { name: 'Weather management' })
  return { fetchMock, user, view }
}

async function openDetail(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole('button', {
      name: 'View Denizli weather for 2026-07-23',
    }),
  )
  await screen.findByRole('button', { name: 'Delete weather record' })
}

async function fillValidCreate(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    screen.getByLabelText('Weather date', {
      selector: '#create-weather-date',
    }),
    '2026-07-23',
  )
  await user.type(screen.getByLabelText('City name'), '  New   City  ')
  await user.type(screen.getByLabelText('Temperature (°C)'), '22.5')
  await user.type(screen.getByLabelText('Main status'), '  Partly   cloudy  ')
}

describe('AdminWeatherPage', () => {
  it('shows loading then renders semantic weather data, icon, and boundaries', async () => {
    let resolveList: ((response: Response) => void) | undefined
    await enterWeather((input) => {
      if (input.toString().endsWith('/api/auth/login')) {
        return json(authentication)
      }
      return new Promise<Response>((resolve) => {
        resolveList = resolve
      })
    })
    expect(screen.getByRole('heading', { name: 'Loading weather records…' }))
      .toBeInTheDocument()
    await waitFor(() => expect(resolveList).toBeTypeOf('function'))
    resolveList?.(new Response(JSON.stringify(page()), { status: 200 }))
    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.getByText('Denizli')).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getByText('Clear')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Weather condition: Clear' }))
      .not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
  })

  it('distinguishes empty unfiltered and filtered results', async () => {
    let request = 0
    const { user } = await enterWeather((input) => {
      if (input.toString().endsWith('/api/auth/login')) {
        return json(authentication)
      }
      request += 1
      return json(page({ items: [], totalCount: 0, totalPages: 0 }))
    })
    expect(await screen.findByRole('heading', { name: 'No weather records yet' }))
      .toBeInTheDocument()
    await user.type(screen.getByLabelText('City'), 'Denizli')
    await user.click(screen.getByRole('button', { name: 'Apply filters' }))
    expect(await screen.findByRole('heading', { name: 'No matching weather records' }))
      .toBeInTheDocument()
    expect(request).toBe(2)
  })

  it('shows safe list failure and retries without backend details', async () => {
    let requests = 0
    const { user } = await enterWeather((input) => {
      if (input.toString().endsWith('/api/auth/login')) return json(authentication)
      requests += 1
      return requests === 1
        ? json({ detail: 'private detail' }, 503)
        : json(page())
    })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Weather records could not be loaded.',
    )
    expect(screen.queryByText('private detail')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('table')).toBeInTheDocument()
  })

  it('trims city, sends valid date, validates length, and clears filters', async () => {
    const { fetchMock, user } = await enterWeather()
    const city = await screen.findByLabelText('City')
    await user.type(city, 'x'.repeat(101))
    await user.click(screen.getByRole('button', { name: 'Apply filters' }))
    expect(screen.getByText('City must be 100 characters or fewer.'))
      .toBeInTheDocument()
    await user.clear(city)
    await user.type(city, '  Denizli  ')
    await user.type(screen.getByLabelText('Weather date'), '2026-07-23')
    await user.click(screen.getByRole('button', { name: 'Apply filters' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) =>
      input.toString().includes('city=Denizli&date=2026-07-23'),
    )).toBe(true))
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    await waitFor(() => expect(screen.getByLabelText('City')).toHaveValue(''))
  })

  it('prevents duplicate pagination and renders the requested page', async () => {
    const { fetchMock, user } = await enterWeather((input) => {
      if (input.toString().endsWith('/api/auth/login')) return json(authentication)
      const requested = Number(new URL(input.toString()).searchParams.get('pageNumber') ?? 1)
      return json(page({
        pageNumber: requested,
        totalCount: 21,
        totalPages: 2,
        items: [weather({ weatherId: requested + 3 })],
      }))
    })
    await user.dblClick(await screen.findByRole('button', { name: 'Next page' }))
    expect(await screen.findByText('Page 2 of 2')).toBeInTheDocument()
    expect(fetchMock.mock.calls.filter(([input]) =>
      input.toString().includes('pageNumber=2'),
    )).toHaveLength(1)
  })

  it('loads endpoint detail and safely handles 404 and stale selections', async () => {
    let detailCalls = 0
    const { user } = await enterWeather((input, init) => {
      const url = input.toString()
      if (/\/api\/admin\/weather\/4$/.test(url) && init?.method === 'GET') {
        detailCalls += 1
        return detailCalls === 1 ? json(weather()) : json({}, 404)
      }
      return successfulFetch(input, init)
    })
    await openDetail(user)
    expect(screen.getByText('Record ID')).toBeInTheDocument()
    expect(screen.getAllByText('32,5 °C')).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Close details' }))
    await user.click(screen.getByRole('button', {
      name: 'View Denizli weather for 2026-07-23',
    }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That weather record no longer exists.',
    )
  })

  it('keeps the newer detail when detail responses resolve out of order', async () => {
    const first = deferredResponse()
    const second = deferredResponse()
    const firstRecord = weather({ weatherId: 4, cityName: 'First City' })
    const secondRecord = weather({ weatherId: 5, cityName: 'Second City' })
    const { user } = await enterWeather((input, init) => {
      const path = new URL(input.toString()).pathname
      if (path.endsWith('/api/admin/weather/4') && init?.method === 'GET') {
        return first.promise
      }
      if (path.endsWith('/api/admin/weather/5') && init?.method === 'GET') {
        return second.promise
      }
      if (path.endsWith('/api/admin/weather')) {
        return json(page({
          items: [firstRecord, secondRecord],
          totalCount: 2,
        }))
      }
      return successfulFetch(input, init)
    })

    await user.click(await screen.findByRole('button', {
      name: 'View First City weather for 2026-07-23',
    }))
    await user.click(screen.getByRole('button', {
      name: 'View Second City weather for 2026-07-23',
    }))
    second.resolve(new Response(JSON.stringify(secondRecord), { status: 200 }))
    const details = await screen.findByRole('heading', {
      name: 'Weather record details',
    })
    expect(within(details.closest('section')!).getByText('Second City'))
      .toBeInTheDocument()
    first.resolve(new Response(JSON.stringify(firstRecord), { status: 200 }))
    await Promise.resolve()
    expect(within(details.closest('section')!).queryByText('First City'))
      .not.toBeInTheDocument()
  })

  it('provides an accessible create dialog, Escape close, and field validation', async () => {
    const { fetchMock, user } = await enterWeather()
    const add = await screen.findByRole('button', { name: 'Add weather record' })
    await user.click(add)
    const dialog = screen.getByRole('dialog', { name: 'Add weather record' })
    expect(dialog).toHaveAccessibleDescription(
      'Enter an authoritative manual weather observation.',
    )
    expect(screen.getByRole('heading', { name: 'Add weather record' })).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('heading', { name: 'Add weather record' })).toHaveFocus()
    await user.tab()
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
    const backgroundAdd = screen.getByRole('button', {
      name: 'Add weather record',
      hidden: true,
    })
    backgroundAdd.focus()
    expect(backgroundAdd).toHaveFocus()
    await user.keyboard('{Tab}')
    expect(screen.getByRole('heading', { name: 'Add weather record' }))
      .toHaveFocus()
    expect(backgroundAdd).not.toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Add record' }))
    expect(screen.getByText('Weather date is required.')).toBeInTheDocument()
    expect(screen.getByText('Temperature is required.')).toBeInTheDocument()
    expect(fetchMock.mock.calls.filter(([input, options]) =>
      input.toString().endsWith('/api/admin/weather') &&
      options?.method === 'POST',
    ))
      .toHaveLength(0)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(add).toHaveFocus())
  })

  it('contains focus in the delete dialog and preserves busy deletion behavior', async () => {
    let resolveDelete: ((response: Response) => void) | undefined
    const { user } = await enterWeather((input, init) => {
      if (init?.method === 'DELETE') {
        return new Promise<Response>((resolve) => {
          resolveDelete = resolve
        })
      }
      return successfulFetch(input, init)
    })
    await openDetail(user)
    const trigger = screen.getByRole('button', { name: 'Delete weather record' })
    await user.click(trigger)
    const dialog = screen.getByRole('alertdialog', {
      name: 'Delete weather record?',
    })
    const heading = screen.getByRole('heading', {
      name: 'Delete weather record?',
    })
    expect(heading).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await user.tab()
    expect(heading).toHaveFocus()
    await user.tab()
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(trigger).toHaveFocus())

    await user.click(trigger)
    await user.click(screen.getByRole('button', { name: 'Confirm deletion' }))
    await user.keyboard('{Escape}')
    const busyDialog = screen.getByRole('alertdialog', {
      name: 'Delete weather record?',
    })
    const busyHeading = within(busyDialog).getByRole('heading', {
      name: 'Delete weather record?',
    })
    expect(busyDialog).toBeInTheDocument()
    await user.tab()
    expect(busyHeading).toHaveFocus()
    resolveDelete?.(new Response(null, { status: 204 }))
    expect(await screen.findByText(/was deleted/i)).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', {
      name: 'Weather record details',
    })).not.toBeInTheDocument()
    const addButton = screen.getByRole('button', {
      name: 'Add weather record',
    })
    await waitFor(() => expect(addButton).toHaveFocus())
    expect(document.activeElement).not.toBe(document.body)
    expect(addButton).toBe(document.activeElement)
    expect(addButton.isConnected).toBe(true)
  })

  it('normalizes and submits create once, then installs authoritative success', async () => {
    let resolvePost: ((response: Response) => void) | undefined
    const { fetchMock, user } = await enterWeather((input, init) => {
      if (
        input.toString().endsWith('/api/admin/weather') &&
        init?.method === 'POST'
      ) {
        return new Promise<Response>((resolve) => {
          resolvePost = resolve
        })
      }
      return successfulFetch(input, init)
    })
    await user.click(await screen.findByRole('button', { name: 'Add weather record' }))
    await fillValidCreate(user)
    await user.dblClick(screen.getByRole('button', { name: 'Add record' }))
    expect(fetchMock.mock.calls.filter(([input, options]) =>
      input.toString().endsWith('/api/admin/weather') &&
      options?.method === 'POST',
    ))
      .toHaveLength(1)
    const post = fetchMock.mock.calls.find(([input, options]) =>
      input.toString().endsWith('/api/admin/weather') &&
      options?.method === 'POST',
    )
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({
      weatherDate: '2026-07-23',
      cityName: 'New City',
      temperature: 22.5,
      mainStatus: 'Partly cloudy',
    })
    resolvePost?.(new Response(JSON.stringify(weather({
      cityName: 'Confirmed City',
    })), { status: 201 }))
    expect(await screen.findByText(/Confirmed City weather record/i))
      .toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('prevents a stale list from overwriting the post-create refresh', async () => {
    const staleList = deferredResponse()
    const refreshedList = deferredResponse()
    let listRequests = 0
    const { user } = await enterWeather((input, init) => {
      const url = input.toString()
      if (url.endsWith('/api/auth/login')) return json(authentication)
      if (init?.method === 'POST') {
        return json(weather({ weatherId: 8, cityName: 'Created City' }), 201)
      }
      listRequests += 1
      if (listRequests === 1) {
        return json(page({ totalCount: 21, totalPages: 2 }))
      }
      return listRequests === 2 ? staleList.promise : refreshedList.promise
    })

    await user.click(await screen.findByRole('button', { name: 'Next page' }))
    await user.click(screen.getByRole('button', { name: 'Add weather record' }))
    await fillValidCreate(user)
    await user.click(screen.getByRole('button', { name: 'Add record' }))
    expect(await screen.findByText(/Created City weather record/i))
      .toBeInTheDocument()
    await waitFor(() => expect(listRequests).toBe(3))
    refreshedList.resolve(new Response(JSON.stringify(page({
      items: [weather({ weatherId: 8, cityName: 'Created City' })],
    })), { status: 200 }))
    expect(await screen.findByText('Created City')).toBeInTheDocument()
    staleList.resolve(new Response(JSON.stringify(page({
      items: [weather({ cityName: 'Stale City' })],
    })), { status: 200 }))
    await Promise.resolve()
    expect(screen.queryByText('Stale City')).not.toBeInTheDocument()
    expect(screen.getByText(/Created City weather record/i)).toBeInTheDocument()
  })

  it.each([
    [400, 'could not be validated'],
    [403, 'not authorized to add'],
    [409, 'already exists'],
  ])('preserves create values after safe %s failure', async (status, message) => {
    const { user } = await enterWeather((input, init) =>
      input.toString().endsWith('/api/admin/weather') &&
      init?.method === 'POST'
        ? json({ detail: 'private detail' }, status)
        : successfulFetch(input, init),
    )
    await user.click(await screen.findByRole('button', { name: 'Add weather record' }))
    await fillValidCreate(user)
    await user.click(screen.getByRole('button', { name: 'Add record' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.getByLabelText('City name')).toHaveValue('  New   City  ')
    expect(screen.queryByText('private detail')).not.toBeInTheDocument()
  })

  it('confirms deletion, prevents duplicates, accepts 204, and refreshes', async () => {
    let resolveDelete: ((response: Response) => void) | undefined
    const { fetchMock, user } = await enterWeather((input, init) => {
      if (init?.method === 'DELETE') {
        return new Promise<Response>((resolve) => {
          resolveDelete = resolve
        })
      }
      return successfulFetch(input, init)
    })
    await openDetail(user)
    await user.click(screen.getByRole('button', { name: 'Delete weather record' }))
    expect(screen.getByRole('alertdialog', { name: 'Delete weather record?' }))
      .toHaveAccessibleDescription(/cannot be undone/i)
    await user.dblClick(screen.getByRole('button', { name: 'Confirm deletion' }))
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'DELETE'))
      .toHaveLength(1)
    resolveDelete?.(new Response(null, { status: 204 }))
    expect(await screen.findByText(/was deleted/i)).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('prevents a stale filtered list from restoring a deleted record', async () => {
    const staleList = deferredResponse()
    const refreshedList = deferredResponse()
    let listRequests = 0
    let filtering = false
    let deleted = false
    const { user } = await enterWeather((input, init) => {
      const url = input.toString()
      if (url.endsWith('/api/auth/login')) return json(authentication)
      if (init?.method === 'DELETE') {
        deleted = true
        return Promise.resolve(new Response(null, { status: 204 }))
      }
      if (/\/api\/admin\/weather\/4$/.test(new URL(url).pathname)) {
        return json(weather())
      }
      listRequests += 1
      if (!filtering) return json(page())
      if (!deleted) return staleList.promise
      return refreshedList.promise
    })

    await openDetail(user)
    filtering = true
    await user.type(screen.getByLabelText('City'), 'Denizli')
    await user.click(screen.getByRole('button', { name: 'Apply filters' }))
    await user.click(screen.getByRole('button', { name: 'Delete weather record' }))
    await user.click(screen.getByRole('button', { name: 'Confirm deletion' }))
    await waitFor(() => expect(listRequests).toBe(3))
    refreshedList.resolve(new Response(JSON.stringify(page({
      items: [],
      totalCount: 0,
      totalPages: 0,
    })), { status: 200 }))
    expect(await screen.findByRole('heading', {
      name: 'No matching weather records',
    })).toBeInTheDocument()
    staleList.resolve(new Response(JSON.stringify(page()), { status: 200 }))
    await Promise.resolve()
    expect(screen.queryByRole('button', {
      name: 'View Denizli weather for 2026-07-23',
    })).not.toBeInTheDocument()
  })

  it('falls back after deleting the final record on a later page', async () => {
    let deleted = false
    const requestedPages: number[] = []
    const { user } = await enterWeather((input, init) => {
      const url = input.toString()
      if (url.endsWith('/api/auth/login')) return json(authentication)
      if (init?.method === 'DELETE') {
        deleted = true
        return Promise.resolve(new Response(null, { status: 204 }))
      }
      if (/\/api\/admin\/weather\/24$/.test(new URL(url).pathname)) {
        return json(weather({ weatherId: 24, cityName: 'Last City' }))
      }
      const requestedPage = Number(new URL(url).searchParams.get('pageNumber'))
      requestedPages.push(requestedPage)
      if (requestedPage === 2 && !deleted) {
        return json(page({
          pageNumber: 2,
          items: [weather({ weatherId: 24, cityName: 'Last City' })],
          totalCount: 21,
          totalPages: 2,
        }))
      }
      if (requestedPage === 2) {
        return json(page({
          pageNumber: 2,
          items: [],
          totalCount: 20,
          totalPages: 1,
        }))
      }
      return json(page({
        items: [weather({ cityName: 'First Page City' })],
        totalCount: deleted ? 20 : 21,
        totalPages: deleted ? 1 : 2,
      }))
    })

    await user.click(await screen.findByRole('button', { name: 'Next page' }))
    await user.click(await screen.findByRole('button', {
      name: 'View Last City weather for 2026-07-23',
    }))
    await screen.findByText('Record ID')
    await user.click(screen.getByRole('button', { name: 'Delete weather record' }))
    await user.click(screen.getByRole('button', { name: 'Confirm deletion' }))
    expect(await screen.findByText('First Page City')).toBeInTheDocument()
    expect(requestedPages).toEqual([1, 2, 2, 1])
  })

  it('cancels delete and safely handles 403 and 404', async () => {
    let status = 403
    const { user } = await enterWeather((input, init) =>
      init?.method === 'DELETE'
        ? json({ detail: 'private detail' }, status)
        : successfulFetch(input, init),
    )
    await openDetail(user)
    await user.click(screen.getByRole('button', { name: 'Delete weather record' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Delete weather record' }))
    await user.click(screen.getByRole('button', { name: 'Confirm deletion' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('not authorized')
    status = 404
    await user.click(screen.getByRole('button', { name: 'Confirm deletion' }))
    expect(await screen.findByText(/no longer exists/i)).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', {
      name: 'Weather record details',
    })).not.toBeInTheDocument()
    const addButton = screen.getByRole('button', {
      name: 'Add weather record',
    })
    await waitFor(() => expect(addButton).toHaveFocus())
    expect(document.activeElement).not.toBe(document.body)
    expect(addButton.isConnected).toBe(true)
  })

  it('uses logout on mutation 401 and ignores results after unmount', async () => {
    const { user } = await enterWeather((input, init) =>
      input.toString().endsWith('/api/admin/weather') &&
      init?.method === 'POST'
        ? json({}, 401)
        : successfulFetch(input, init),
    )
    await user.click(await screen.findByRole('button', { name: 'Add weather record' }))
    await fillValidCreate(user)
    await user.click(screen.getByRole('button', { name: 'Add record' }))
    expect(await screen.findByRole('heading', { name: /sign in to your account/i }))
      .toBeInTheDocument()
  })

  it('logs out directly when deletion returns 401', async () => {
    const { user } = await enterWeather((input, init) =>
      init?.method === 'DELETE'
        ? json({}, 401)
        : successfulFetch(input, init),
    )
    await openDetail(user)
    await user.click(screen.getByRole('button', { name: 'Delete weather record' }))
    await user.click(screen.getByRole('button', { name: 'Confirm deletion' }))
    expect(await screen.findByRole('heading', { name: /sign in to your account/i }))
      .toBeInTheDocument()
  })

  it.each(['create', 'delete'] as const)(
    'unmounts safely while a %s mutation is pending',
    async (mutation) => {
      const pending = deferredResponse()
      const { user, view, fetchMock } = await enterWeather((input, init) => {
      if (
          (mutation === 'create' &&
            input.toString().endsWith('/api/admin/weather') &&
            init?.method === 'POST') ||
          (mutation === 'delete' && init?.method === 'DELETE')
        ) {
          return pending.promise
        }
        return successfulFetch(input, init)
      })
      if (mutation === 'create') {
        await user.click(screen.getByRole('button', { name: 'Add weather record' }))
        await fillValidCreate(user)
        await user.click(screen.getByRole('button', { name: 'Add record' }))
      } else {
        await openDetail(user)
        await user.click(screen.getByRole('button', {
          name: 'Delete weather record',
        }))
        await user.click(screen.getByRole('button', {
          name: 'Confirm deletion',
        }))
      }
      expect(fetchMock.mock.calls.some(([, init]) =>
        init?.method === (mutation === 'create' ? 'POST' : 'DELETE'),
      )).toBe(true)
      view.unmount()
      pending.resolve(
        mutation === 'create'
          ? new Response(JSON.stringify(weather()), { status: 201 })
          : new Response(null, { status: 204 }),
      )
      await Promise.resolve()
    },
  )

  it.each([
    ['-90', -90],
    ['60', 60],
    ['6e1', 60],
  ])('accepts contract-compatible temperature %s', async (value, expected) => {
    let submittedTemperature: number | undefined
    const { user } = await enterWeather((input, init) => {
      if (
        input.toString().endsWith('/api/admin/weather') &&
        init?.method === 'POST'
      ) {
        submittedTemperature = JSON.parse(String(init.body)).temperature as number
        return json(weather(), 201)
      }
      return successfulFetch(input, init)
    })

    await user.click(await screen.findByRole('button', {
      name: 'Add weather record',
    }))
    await fillValidCreate(user)
    const temperature = screen.getByLabelText('Temperature (°C)')
    await user.clear(temperature)
    await user.type(temperature, value)
    await user.click(screen.getByRole('button', { name: 'Add record' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(submittedTemperature).toBe(expected)
  })

  it.each([
    ['', 'Temperature is required.'],
    ['-90.1', 'Temperature must be between -90 and 60.'],
    ['60.1', 'Temperature must be between -90 and 60.'],
    ['1e1000', 'Temperature is required.'],
  ])('rejects invalid temperature input %s', async (value, message) => {
    const { fetchMock, user } = await enterWeather()
    await user.click(await screen.findByRole('button', {
      name: 'Add weather record',
    }))
    await fillValidCreate(user)
    const temperature = screen.getByLabelText('Temperature (°C)')
    await user.clear(temperature)
    if (value) {
      await user.type(temperature, value)
    }
    await user.click(screen.getByRole('button', { name: 'Add record' }))
    expect(screen.getByText(message)).toBeInTheDocument()
    expect(fetchMock.mock.calls.filter(([input, init]) =>
      input.toString().endsWith('/api/admin/weather') &&
      init?.method === 'POST',
    ))
      .toHaveLength(0)
  })

  it('unmounts safely while list loading is pending', async () => {
    let resolveList: ((response: Response) => void) | undefined
    const { view } = await enterWeather((input) => {
      if (input.toString().endsWith('/api/auth/login')) return json(authentication)
      return new Promise<Response>((resolve) => {
        resolveList = resolve
      })
    })
    await waitFor(() => expect(resolveList).toBeTypeOf('function'))
    view.unmount()
    resolveList?.(new Response(JSON.stringify(page()), { status: 200 }))
    await Promise.resolve()
  })
})
