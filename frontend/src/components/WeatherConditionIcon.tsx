interface WeatherConditionIconProps {
  condition: string
}

const indicators: Array<{ terms: string[]; symbol: string }> = [
  { terms: ['clear', 'sunny'], symbol: '☀' },
  { terms: ['partly cloudy'], symbol: '⛅' },
  { terms: ['cloud', 'overcast'], symbol: '☁' },
  { terms: ['rain', 'drizzle', 'shower'], symbol: '🌧' },
  { terms: ['snow', 'sleet', 'blizzard'], symbol: '❄' },
  { terms: ['thunder', 'storm'], symbol: '⛈' },
  { terms: ['fog', 'mist'], symbol: '≋' },
]

export function WeatherConditionIcon({
  condition,
}: WeatherConditionIconProps) {
  const normalizedCondition = condition.trim().toLowerCase()
  const indicator = indicators.find(({ terms }) =>
    terms.some((term) => normalizedCondition.includes(term)),
  )

  return (
    <span
      className="weather-condition-icon"
      role="img"
      aria-label={`Weather condition: ${condition}`}
    >
      {indicator?.symbol ?? '◇'}
    </span>
  )
}
