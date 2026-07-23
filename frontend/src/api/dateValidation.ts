const dateOnlyPattern = /^(\d{4})-(\d{2})-(\d{2})$/
const timestampPattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,7})?(Z|([+-])(\d{2}):(\d{2}))$/

function isLeapYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

function isValidCalendarDate(year: number, month: number, day: number) {
  if (year < 1 || year > 9999 || month < 1 || month > 12) {
    return false
  }

  const daysInMonth = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ]

  return day >= 1 && day <= daysInMonth[month - 1]
}

export function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false
  }

  const match = dateOnlyPattern.exec(value)
  return (
    match !== null &&
    isValidCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]))
  )
}

export function isExplicitTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false
  }

  const match = timestampPattern.exec(value)
  if (!match) {
    return false
  }

  const [, year, month, day, hour, minute, second, zone, , offsetHour, offsetMinute] =
    match

  if (
    !isValidCalendarDate(Number(year), Number(month), Number(day)) ||
    Number(hour) > 23 ||
    Number(minute) > 59 ||
    Number(second) > 59
  ) {
    return false
  }

  if (zone === 'Z') {
    return true
  }

  const numericOffsetHour = Number(offsetHour)
  const numericOffsetMinute = Number(offsetMinute)
  return (
    numericOffsetHour <= 14 &&
    numericOffsetMinute <= 59 &&
    (numericOffsetHour < 14 || numericOffsetMinute === 0)
  )
}
