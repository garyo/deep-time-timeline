// DeepTime: A date/time class that uses 64-bit float minutes since 1970 UTC
// for universal representation.
import { Temporal } from 'temporal-polyfill'

// Sometimes we convert to/from Temporal, for display & arithmetic
// Temporal's range: approximately ±271,821 years from Unix epoch (1970)
const TEMPORAL_MIN_YEAR = -269851 // 271821 BCE
const TEMPORAL_MAX_YEAR = 277730 // 275760 CE

// Constants for time conversion
export const MINUTES_PER_YEAR = 525948.768 // Average astronomical year
export const MINUTES_PER_DAY = 24 * 60
export const MINUTES_PER_HOUR = 60
const UNIX_EPOCH_YEAR = 1970

export type DeepTimeSpec =
  | { minutesSinceEpoch: number }
  | { yearsAgo: number }
  | { year: number } // astronomical year number (0 means 1BCE)
  | string // ISO or year string
  | Date
  | Temporal.ZonedDateTime

export class DeepTime {
  // Internal representation: minutes since 1970-01-01T00:00:00 UTC
  private minutesSinceEpoch: number = 0

  constructor(input?: DeepTimeSpec | DeepTime) {
    if (input === undefined) {
      // Current time
      this.minutesSinceEpoch = Date.now() / (60 * 1000)
    } else if (input instanceof DeepTime) {
      // Copy constructor
      this.minutesSinceEpoch = input.minutesSinceEpoch
    } else if (input instanceof Date) {
      // JavaScript Date
      this.minutesSinceEpoch = input.getTime() / (60 * 1000)
    } else if (input instanceof Temporal.ZonedDateTime) {
      // Temporal object
      this.minutesSinceEpoch = input.epochMilliseconds / (60 * 1000)
    } else if (typeof input === 'object' && 'minutesSinceEpoch' in input) {
      this.minutesSinceEpoch = input.minutesSinceEpoch
    } else if (typeof input === 'object' && 'year' in input) {
      this.setFromYear(input.year)
    } else if (typeof input === 'object' && 'yearsAgo' in input) {
      this.setFromYearsAgo(input.yearsAgo)
    } else if (typeof input === 'string') {
      // ISO string or year string
      this.setFromString(input)
    }
  }

  // 12:00:00 Jan 1 UTC of year (int)
  // Year is astronomical calendar year so 0 = 1BCE
  private setFromYear(year: number): void {
    year = Math.floor(year)
    // For years within Temporal range, use Temporal for accuracy
    if (year >= TEMPORAL_MIN_YEAR && year <= TEMPORAL_MAX_YEAR) {
      try {
        const temporal = Temporal.ZonedDateTime.from({
          timeZone: 'UTC',
          year: year,
          month: 1,
          day: 1,
          hour: 0,
          minute: 0,
          second: 0
        })
        this.minutesSinceEpoch = temporal.epochMilliseconds / (60 * 1000)
        return
      } catch {
        // Fall through if Temporal fails
      }
    }

    // Convert year to minutes since epoch for dates outside Temporal range
    const yearsSinceEpoch = year - UNIX_EPOCH_YEAR
    this.minutesSinceEpoch = yearsSinceEpoch * MINUTES_PER_YEAR
  }

  private setFromYearsAgo(yearsAgo: number): void {
    const now = Temporal.Now.zonedDateTimeISO()
    // If yearsAgo is integral, use Temporal for accuracy
    if (Number.isInteger(yearsAgo)) {
      try {
        const date = now.subtract({ years: yearsAgo })
        this.minutesSinceEpoch = date.epochMilliseconds / (60 * 1000)
        return
      } catch {
        // fall through if it's too large (RangeError)
      }
    }
    // get current minutes since epoch, subtract years
    const currentMinutes = now.epochMilliseconds / (60 * 1000)
    this.minutesSinceEpoch = currentMinutes - yearsAgo * MINUTES_PER_YEAR
  }

  private setFromString(input: string): void {
    // "now" uses current date
    if (input === 'now') {
      this.minutesSinceEpoch = Date.now() / (60 * 1000)
      return
    }

    // Dates like 2025-01-01 should be interpreted as UTC
    const isoDateMatch = input.match(/^[0-9]{4}-{0-9][0-9]-[0-9][0-9]}$/i)
    if (isoDateMatch) input = input + '[UTC]'

    // Try to parse as timezoned ISO string
    try {
      // Convert Z suffix to [UTC] for compatibility
      let normalizedInput = input
      if (input.endsWith('Z')) {
        normalizedInput = input.slice(0, -1) + '[UTC]'
      }
      const temporal = Temporal.ZonedDateTime.from(normalizedInput)
      this.minutesSinceEpoch = temporal.epochMilliseconds / (60 * 1000)
      return
    } catch (err) {
      // Not a valid ISO zoned string, keep trying
    }

    // Try to parse as ISO string without TZ, like 2025-01-01
    // (Interpret as UTC)
    try {
      const temporal = Temporal.PlainDateTime.from(input).toZonedDateTime('UTC')
      this.minutesSinceEpoch = temporal.epochMilliseconds / (60 * 1000)
      return
    } catch (err) {
      // fall through, try other methods
    }

    // Try to parse as year, e.g. "-10000", "100BC", "2025CE", or just "2025"
    // (returns Jan 1 of that year)
    const yearMatch = input.match(
      /^(-?\d+(?:\.\d+)?)(?:\s*(?:BC|AD|CE|BCE))?$/i
    )
    if (yearMatch) {
      let year = parseFloat(yearMatch[1])
      if (
        input.toUpperCase().includes('BC') ||
        input.toUpperCase().includes('BCE')
      ) {
        // BC years: 1 BC = year 0, 2 BC = year -1, etc.
        year = -Math.abs(year) + 1
      }
      this.setFromYear(year)
      return
    }

    // Try parsing it as a number -- this should allow -1.2e6 for 1.2Mya
    const year = parseFloat(input)
    if (!Number.isNaN(year)) {
      this.setFromYear(year)
      return
    }

    throw new Error(`Unable to parse DeepTime from string: ${input}`)
  }

  // Factory methods

  static now(): DeepTime {
    return new DeepTime()
  }

  // Getters

  // "Astronomical" year number in years since calendar epoch, using the
  // proleptic Gregorian calendar (so it returns 0 for 1BCE)
  // Returns an int (i.e. start of that year)
  get year(): number {
    // For dates within Temporal range, use Temporal for accurate year
    if (this.isWithinTemporalRange && this.temporal) {
      return this.temporal.year
    }
    // For ancient dates, calculate year from minutes
    const yearsSinceEpoch = this.minutesSinceEpoch / MINUTES_PER_YEAR
    return Math.floor(yearsSinceEpoch + UNIX_EPOCH_YEAR)
  }

  // Astronomical year, as a float e.g. 2025.333
  get toYear(): number {
    return this.minutesSinceEpoch / MINUTES_PER_YEAR + UNIX_EPOCH_YEAR
  }

  // Check if this time is within Temporal's range
  get isWithinTemporalRange(): boolean {
    // Calculate approximate year without using the year getter to avoid recursion
    const yearsSinceEpoch = this.minutesSinceEpoch / MINUTES_PER_YEAR
    const approxYear = yearsSinceEpoch + UNIX_EPOCH_YEAR
    return approxYear >= TEMPORAL_MIN_YEAR && approxYear <= TEMPORAL_MAX_YEAR
  }

  // Get Temporal ZonedDateTimeISO object (with tz=UTC) if within range
  get temporal(): Temporal.ZonedDateTime | undefined {
    if (!this.isWithinTemporalRange) {
      return undefined
    }

    try {
      const epochMs = this.minutesSinceEpoch * 60 * 1000
      const instant = Temporal.Instant.fromEpochMilliseconds(
        Math.round(epochMs)
      )
      return instant.toZonedDateTimeISO('UTC')
    } catch {
      return undefined
    }
  }

  // Time manipulation
  add(
    duration: {
      years?: number
      months?: number
      days?: number
      hours?: number
      minutes?: number
      seconds?: number
    },
    sign: number = 1
  ): DeepTime {
    if (sign != 1 && sign != -1) throw new Error('add: sign must be 1 or -1')

    const result = new DeepTime(this)

    // Quick check for adding zero
    let allZeros = true
    for (const [_, value] of Object.entries(duration)) {
      if (value !== undefined && value !== 0) {
        allZeros = false
        break
      }
    }
    if (allZeros) return result

    // quick exit when adding/subtracting big years
    function withinTemporalRange(years: number | undefined) {
      if (years === undefined) return true
      if (years < TEMPORAL_MAX_YEAR && years > TEMPORAL_MIN_YEAR) return true
      return false
    }

    // For precise calculations within Temporal range, maybe use Temporal.
    // But only when fields are integers; otherwise use direct math.
    // It's an error to try to use fractional months.
    // Note: Temporal can be slow, so avoid it if possible.
    if (
      this.isWithinTemporalRange &&
      withinTemporalRange(duration.years) &&
      this.temporal
    ) {
      const hasMonths = duration.months != undefined && duration.months !== 0
      let allIntegers = true
      for (const [_, value] of Object.entries(duration)) {
        if (value !== undefined && !Number.isInteger(value)) {
          allIntegers = false
        }
      }
      const useTemporal = hasMonths || allIntegers
      if (useTemporal) {
        // Check if all values are integers as required by Temporal
        for (const [key, value] of Object.entries(duration)) {
          if (value !== undefined && !Number.isInteger(value)) {
            throw new Error(
              `Duration property '${key}' must be an integer, got: ${value}`
            )
          }
        }

        try {
          const newTemporal =
            sign > 0
              ? this.temporal.add(duration)
              : this.temporal.subtract(duration)
          result.minutesSinceEpoch = newTemporal.epochMilliseconds / (60 * 1000)
          return result
        } catch {
          // Fall back to simple calculation if Temporal fails (likely with RangeError)
        }
      }
    }

    // Simple arithmetic for years and basic time units
    if (duration.years !== undefined) {
      result.minutesSinceEpoch += sign * duration.years * MINUTES_PER_YEAR
    }
    if (duration.days !== undefined) {
      result.minutesSinceEpoch += sign * duration.days * MINUTES_PER_DAY
    }
    if (duration.hours !== undefined) {
      result.minutesSinceEpoch += sign * duration.hours * MINUTES_PER_HOUR
    }
    if (duration.minutes !== undefined) {
      result.minutesSinceEpoch += sign * duration.minutes
    }
    if (duration.seconds !== undefined) {
      result.minutesSinceEpoch += (sign * duration.seconds) / 60
    }

    return result
  }

  subtract(duration: {
    years?: number
    months?: number
    days?: number
    hours?: number
    minutes?: number
    seconds?: number
  }): DeepTime {
    return this.add(duration, -1)
  }

  /** Get time difference in minutes from another DeepTime, i.e. this - other */
  since(other: DeepTime): number {
    return this.minutesSinceEpoch - other.minutesSinceEpoch
  }

  /** Get time difference in minutes from another DeepTime, i.e. other - this */
  until(other: DeepTime): number {
    return other.since(this)
  }

  // Comparison
  equals(other: DeepTime): boolean {
    return Math.abs(this.since(other)) < 1 // allow 1 minute difference
  }

  compare(other: DeepTime): number {
    if (this.minutesSinceEpoch < other.minutesSinceEpoch) return -1
    if (this.minutesSinceEpoch > other.minutesSinceEpoch) return 1
    return 0
  }

  // Log-space methods for use in timeline
  // refTime is the "zero" time, usually now. But for stable behavior,
  // it's best to get "now" once and pass it in.

  // logTime = log(refTime - this.minutesSinceEpoch)
  // with clamping to a minimum reasonable number (I choose 0, for 1 minute)
  toLog(refTime?: DeepTime): number {
    if (refTime === undefined) refTime = new DeepTime()
    if (refTime.since(this) <= 0) {
      return 0 // Can't be past the ref time; assume they're the same.
      // Could throw error instead, but with numerical inaccuracies it can
      // get triggered unexpectedly.
    }
    return Math.max(0, Math.log(refTime.since(this)))
  }

  // Convert log time diff (rel to refTime) back to minutes since epoch
  // minutesSinceEpoch = refTime - exp(logTime)
  // Note: does not use or modify `this`.
  // Use `this.setMinutesSince1970(DeepTime.fromLog(x, ref))` to update a DeepTime.
  static fromLog(logTime: number, refTime?: DeepTime): number {
    if (refTime === undefined) refTime = new DeepTime()
    const dt = Math.exp(logTime) // in minutes
    return refTime.minutesSinceEpoch - dt
  }

  // Formatting
  toString(): string {
    if (this.isWithinTemporalRange && this.temporal) {
      // TODO: could do .withCalendar("gregory") and print a fancier string with BCE
      return this.temporal.toString()
    } else {
      let eraYear = this.year
      let era = 'CE'
      if (this.year <= 0) {
        eraYear = 1 - this.year
        era = 'BCE'
      }
      if (eraYear >= 1000000) {
        return `${(eraYear / 1000000).toFixed(1)}M years ${era}`
      } else if (eraYear >= 10000) {
        return `${(eraYear / 1000).toFixed(1)}K years ${era}`
      } else {
        return `${Math.round(eraYear)}${era}`
      }
    }
  }

  // Human-readable relative time
  toRelativeString(relativeTo?: DeepTime): string {
    const reference = relativeTo || DeepTime.now()
    let minutesDiff = reference.since(this)
    let rel = 'ago'
    if (minutesDiff < 0) {
      minutesDiff = -minutesDiff
      rel = 'hence'
    }
    const yearsDiff = minutesDiff / MINUTES_PER_YEAR

    // Use precise time for recent dates
    if (minutesDiff < 1) {
      return 'now'
    } else if (minutesDiff < 1.5) {
      return `${Math.round(minutesDiff)} minute ${rel}`
    } else if (minutesDiff < 60) {
      return `${Math.round(minutesDiff)} minutes ${rel}`
    } else if (minutesDiff < 1.5 * 60) {
      return `${Math.round(minutesDiff / 60)} hour ${rel}`
    } else if (minutesDiff < 24 * 60) {
      return `${Math.round(minutesDiff / 60)} hours ${rel}`
    } else if (minutesDiff < MINUTES_PER_YEAR) {
      return `${Math.round(minutesDiff / (24 * 60))} days ${rel}`
    } else if (yearsDiff < 10000) {
      return `${Math.round(yearsDiff)} years ${rel}`
    } else if (yearsDiff < 1_000_000) {
      return `${Math.round(yearsDiff / 1000)},000 years ${rel}`
    } else if (yearsDiff < 10_000_000) {
      return `${(yearsDiff / 1_000_000).toFixed(1)} million years ${rel}`
    } else if (yearsDiff < 1_000_000_000) {
      return `${(yearsDiff / 1_000_000).toFixed(0)} million years ${rel}`
    } else if (yearsDiff < 1e12) {
      return `${(yearsDiff / 1e9).toFixed(1)} billion years ${rel}`
    } else if (yearsDiff < 1e15) {
      return `${(yearsDiff / 1e12).toFixed(1)} trillion years ${rel}`
    } else {
      const log10 = Math.floor(Math.log10(yearsDiff))
      const div = 10 ** log10
      return `${(yearsDiff / div).toFixed(1)} x 10^${log10} years ${rel}`
    }
  }

  // Locale-aware formatting
  toLocaleString(
    locales?: string | string[],
    options?: Intl.DateTimeFormatOptions
  ): string {
    if (this.isWithinTemporalRange && this.temporal) {
      const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
      return this.temporal
        .withTimeZone(userTimeZone)
        .toLocaleString(locales, options)
    } else {
      // For dates outside Temporal range, return a simple year representation
      return this.toString()
    }
  }

  // Convert to JavaScript Date (only for Temporal precision)
  toDate(): Date {
    if (this.isWithinTemporalRange) {
      return new Date(this.minutesSinceEpoch * 60 * 1000)
    }
    throw new Error('Cannot convert ancient DeepTime to Date')
  }

  // Get raw minutes since epoch
  get minutesSince1970(): number {
    return this.minutesSinceEpoch
  }

  // Set raw minutes since epoch
  set minutesSince1970(val: number) {
    this.minutesSinceEpoch = val
  }
}

// Export useful constants as astronomical year numbers
export const GEOLOGICAL_EVENTS = {
  BIG_BANG: -13.8e9, // 13.8 billion years ago
  EARTH_FORMATION: -4.54e9, // 4.54 billion years ago
  FIRST_LIFE: -3.8e9, // 3.8 billion years ago
  CAMBRIAN_EXPLOSION: -541e6, // 541 million years ago
  DINOSAUR_EXTINCTION: -66e6, // 66 million years ago
  HUMAN_SPECIES: -300_000, // 300,000 years ago
  AGRICULTURE: -10_000, // 10,000 years BCE
  INDUSTRIAL_REVOLUTION: 1760,
  INTERNET_CREATION: 1983
} as const
