interface WeatherConditionIconProps {
  condition: string
  decorative?: boolean
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
  decorative = false,
}: WeatherConditionIconProps) {
  const normalizedCondition = condition.trim().toLowerCase()
  const indicator = indicators.find(({ terms }) =>
    terms.some((term) => normalizedCondition.includes(term)),
  )

  return (
    <span
      className="weather-condition-icon"
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : `Weather condition: ${condition}`}
      aria-hidden={decorative ? true : undefined}
    >
      {indicator?.symbol ?? '◇'}
    </span>
  )
}
