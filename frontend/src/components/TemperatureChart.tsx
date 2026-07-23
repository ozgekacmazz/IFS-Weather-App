import type { CurrentWeather } from '../api/weatherApi'

interface TemperatureChartProps {
  items: CurrentWeather[]
}

const chartWidth = 700
const chartHeight = 260
const horizontalPadding = 52
const verticalPadding = 34

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
  }).format(new Date(`${value}T00:00:00Z`))
}

function formatTemperature(value: number) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
  }).format(value)
}

export function TemperatureChart({ items }: TemperatureChartProps) {
  const orderedItems = [...items].sort((left, right) =>
    left.weatherDate.localeCompare(right.weatherDate),
  )

  if (orderedItems.length === 0) {
    return null
  }

  const temperatures = orderedItems.map((item) => item.temperature)
  const rawMinimum = Math.min(...temperatures)
  const rawMaximum = Math.max(...temperatures)
  const minimum = rawMinimum === rawMaximum ? rawMinimum - 1 : rawMinimum
  const maximum = rawMinimum === rawMaximum ? rawMaximum + 1 : rawMaximum
  const drawableWidth = chartWidth - horizontalPadding * 2
  const drawableHeight = chartHeight - verticalPadding * 2
  const points = orderedItems.map((item, index) => {
    const x =
      orderedItems.length === 1
        ? chartWidth / 2
        : horizontalPadding +
          (index / (orderedItems.length - 1)) * drawableWidth
    const y =
      verticalPadding +
      ((maximum - item.temperature) / (maximum - minimum)) * drawableHeight

    return { item, x, y }
  })
  const path = points
    .map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`)
    .join(' ')

  return (
    <div className="temperature-chart">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        role="img"
        aria-labelledby="temperature-chart-title temperature-chart-description"
      >
        <title id="temperature-chart-title">Weekly temperature trend</title>
        <desc id="temperature-chart-description">
          A line chart of the recorded temperatures listed below.
        </desc>
        <line
          className="chart-axis"
          x1={horizontalPadding}
          y1={chartHeight - verticalPadding}
          x2={chartWidth - horizontalPadding}
          y2={chartHeight - verticalPadding}
        />
        <path className="chart-line" d={path} />
        {points.map(({ item, x, y }) => (
          <g key={`${item.weatherDate}-${item.weatherId}`}>
            <circle className="chart-point" cx={x} cy={y} r="6" />
            <text className="chart-value" x={x} y={y - 14} textAnchor="middle">
              {formatTemperature(item.temperature)}
            </text>
            <text
              className="chart-label"
              x={x}
              y={chartHeight - 10}
              textAnchor="middle"
            >
              {formatShortDate(item.weatherDate)}
            </text>
          </g>
        ))}
      </svg>
      <ol className="forecast-list" aria-label="Daily forecast values">
        {orderedItems.map((item) => (
          <li key={item.weatherId}>
            <time dateTime={item.weatherDate}>
              {formatShortDate(item.weatherDate)}
            </time>
            <strong>{formatTemperature(item.temperature)}</strong>
            <span>{item.mainStatus}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
