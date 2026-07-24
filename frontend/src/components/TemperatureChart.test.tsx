import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CurrentWeather } from '../api/weatherApi'
import { TemperatureChart } from './TemperatureChart'
import { WeatherConditionIcon } from './WeatherConditionIcon'

function weather(
  weatherId: number,
  weatherDate: string,
  temperature: number,
): CurrentWeather {
  return {
    weatherId,
    weatherDate,
    temperature,
    minimumTemperature: null,
    maximumTemperature: null,
    averageHumidity: null,
    maximumWindSpeedKph: null,
    precipitationProbability: null,
    cityName: 'Istanbul',
    mainStatus: 'Clear',
    updatedAt: '2026-07-23T08:00:00Z',
    recommendations: [],
  }
}

describe('TemperatureChart', () => {
  it('sorts partial forecast values and charts negative temperatures', () => {
    const { container } = render(
      <TemperatureChart
        items={[
          weather(2, '2026-07-24', -2),
          weather(1, '2026-07-22', -8),
        ]}
      />,
    )

    const values = screen.getAllByRole('listitem')
    expect(values[0]).toHaveTextContent('-8 °C')
    expect(values[1]).toHaveTextContent('-2 °C')
    const path = container.querySelector('.chart-line')?.getAttribute('d')
    expect(path).toMatch(/^M /)
    expect(path).not.toMatch(/NaN|Infinity/)
    expect(container.querySelector('.chart-line')).toHaveAttribute(
      'pathLength',
      '1',
    )
    expect(container.querySelectorAll('.chart-point-group')).toHaveLength(2)
  })

  it('provides a described keyboard-accessible mobile scroll region', () => {
    render(
      <TemperatureChart items={[weather(1, '2026-07-22', 12.5)]} />,
    )

    const region = screen.getByRole('region', {
      name: 'Scrollable weekly temperature chart',
    })
    expect(region).toHaveAttribute('tabindex', '0')
    const descriptionId = region.getAttribute('aria-describedby')
    expect(descriptionId).toBeTruthy()
    expect(document.getElementById(descriptionId!)).toHaveTextContent(
      /scrolled horizontally on smaller screens/i,
    )
    expect(screen.getByRole('listitem')).toHaveTextContent(/12[.,]5 °C/)
  })

  it('handles identical temperatures without invalid coordinates', () => {
    const { container } = render(
      <TemperatureChart
        items={[
          weather(1, '2026-07-22', 12),
          weather(2, '2026-07-23', 12),
          weather(3, '2026-07-24', 12),
        ]}
      />,
    )

    expect(container.querySelector('.chart-line')?.getAttribute('d')).not.toMatch(
      /NaN|Infinity/,
    )
    expect(
      screen.getByRole('img', { name: /weekly temperature trend/i }),
    ).toBeInTheDocument()
  })

  it('uses an accessible neutral fallback for an unknown condition', () => {
    render(<WeatherConditionIcon condition="Unmapped condition" />)

    expect(
      screen.getByRole('img', {
        name: 'Weather condition: Unmapped condition',
      }),
    ).toHaveTextContent('◇')
  })
})
