import { describe, it, expect, beforeEach } from 'vitest'
import {
  DeepTime,
  GEOLOGICAL_EVENTS,
  MINUTES_PER_YEAR,
  MINUTES_PER_DAY
} from '../src/deep-time'
import { Temporal } from 'temporal-polyfill'

describe('DeepTime', () => {
  describe('Constructor and Factory Methods', () => {
    it('should create current time with no arguments', () => {
      const now = new DeepTime()
      expect(now.year).toBeCloseTo(2025, 0)
    })

    it('should create from year number (recent)', () => {
      const recent = new DeepTime({ year: 2020 })
      expect(recent.year).toBe(2020)
    })

    it('should create from years-ago', () => {
      const recent = new DeepTime({ yearsAgo: 1000 })
      expect(recent.year).toBeCloseTo(1025, -1)
    })

    it('should create from fractional years-ago', () => {
      const dt1 = new DeepTime({ yearsAgo: 0 })
      const dt2 = new DeepTime({ yearsAgo: 0.01 })
      expect(dt1.equals(dt2)).toBeFalsy()
      expect(dt1.since(dt2)).toBeCloseTo(0.01 * MINUTES_PER_YEAR)
    })

    it('should give the same result for years-ago=0 and now', () => {
      // note: possible time skew, but `equals` should allow it
      const dt1 = new DeepTime({ yearsAgo: 0 })
      const dt2 = new DeepTime()
      expect(dt1.equals(dt2)).toBeTruthy()
    })

    it('should create from year number (ancient)', () => {
      const ancient = new DeepTime({ year: -1e9 }) // 1 billion BC
      expect(ancient.year).toBe(-1e9)
    })

    it('should create from minutes-since-epoch', () => {
      const dt = new DeepTime({ minutesSinceEpoch: 123 })
      expect(dt.year).toBe(1970)
    })

    it('should create from Temporal object', () => {
      const temporal = Temporal.ZonedDateTime.from('2023-05-15T12:30:00[UTC]')
      const longTime = new DeepTime(temporal)
      expect(longTime.year).toBe(2023)
    })

    it('should create from JavaScript Date', () => {
      const date = new Date('2023-05-15T12:30:00Z')
      const longTime = new DeepTime(date)
      expect(longTime.year).toBe(2023)
    })

    it('should create from ISO string', () => {
      const longTime = new DeepTime('2023-05-15T12:30:00[UTC]')
      expect(longTime.year).toBe(2023)
    })

    it('should create from ISO date string', () => {
      const longTime = new DeepTime('2021-01-15')
      expect(longTime.year).toBe(2021)
    })

    it('should create from zoned ISO date string', () => {
      const longTime = new DeepTime('2001-09-11[America/New_York]')
      expect(longTime.year).toBe(2001)
    })

    it('should create from year string', () => {
      const longTime = new DeepTime('2023')
      expect(longTime.year).toBe(2023)
    })

    it('should create from BC year string', () => {
      const longTime = new DeepTime('1000 BC')
      expect(longTime.year).toBe(-999) // 1000 BC is year -999 in ISO 8601
    })
    it('should create from exponential year string', () => {
      const longTime = new DeepTime('-1.23e6')
      expect(longTime.year).toBe(-1_230_000)
    })

    it('should copy construct from another DeepTime', () => {
      const original = new DeepTime({ year: 2020 })
      const copy = new DeepTime(original)
      expect(copy.year).toBe(original.year)
      expect(copy.equals(original))
      expect(original.equals(copy))
    })
  })

  describe('Factory Methods', () => {
    it('should create current time', () => {
      const now = DeepTime.now()
      const currentYear = Temporal.Now.zonedDateTimeISO().year
      expect(now.year).toBe(currentYear)
    })
  })

  describe('Time Arithmetic', () => {
    it('should add years to temporal precision dates', () => {
      const base = new DeepTime({ year: 2020 })
      const future = base.add({ years: 5 })
      expect(future.year).toBe(2025)
    })

    it('should add years to ancient dates', () => {
      const ancient = new DeepTime({ year: -1e9 })
      const later = ancient.add({ years: 0.5e9 })
      expect(later.year).toBe(-5e8)
    })

    it('should add complex durations to temporal dates', () => {
      const base = new DeepTime({ year: 2020 })
      const future = base.add({ years: 1, months: 6, days: 15 })
      // Should be mid-2021
      expect(future.year).toBeCloseTo(2021, 0)
    })

    it('should subtract years from temporal precision dates', () => {
      const base = new DeepTime({ year: 2020 })
      const past = base.subtract({ years: 5 })
      expect(past.year).toBe(2015)
    })

    it('should subtract years from ancient dates', () => {
      const ancient = new DeepTime({ year: -1.0e9 })
      const earlier = ancient.subtract({ years: 5e8 })
      expect(earlier.year).toBe(-1.5e9)
    })

    it('should handle arithmetic that pushes dates out of temporal range', () => {
      const nearBoundary = new DeepTime({ year: -250000 })
      const wayPast = nearBoundary.subtract({ years: 100000 })
      expect(wayPast.year).toBeCloseTo(-350000, -1)
    })
  })

  describe('Time Differences', () => {
    it('should calculate difference between temporal dates', () => {
      const date1 = new DeepTime({ year: 2020 })
      const date2 = new DeepTime({ year: 2025 })
      const diffMinutes = date2.since(date1)

      expect(diffMinutes).toBeCloseTo(5 * MINUTES_PER_YEAR, -4) // 5 years, in minutes
    })

    it('should calculate difference between ancient dates', () => {
      const ancient1 = new DeepTime({ year: -1e9 })
      const ancient2 = new DeepTime({ year: -5e8 })
      const diff = ancient2.since(ancient1)

      expect(diff).toBe(5e8 * MINUTES_PER_YEAR)
    })

    it('should calculate difference between current and ancient dates', () => {
      const recent = new DeepTime({ year: 2020 })
      const ancient = new DeepTime({ year: -1000000000 })
      const diff = recent.since(ancient)

      expect(diff).toBeCloseTo(1000002020 * MINUTES_PER_YEAR, -3)
    })

    it("should calculate `until' difference", () => {
      const date1 = new DeepTime({ year: 2020 })
      const date2 = new DeepTime({ year: 2025 })
      const diff = date1.until(date2)

      expect(diff).toBeCloseTo(5 * MINUTES_PER_YEAR, -4)
    })

    it('should be able to add durations', () => {
      const dt = new DeepTime('2025-07-01T12:00:00+00:00[UTC]')

      // This will use temporal
      let result = dt.add({ years: 1 })
      expect(result).toBeDefined()
      expect(result.toYear).toBeCloseTo(2026.5, 1)
      expect(result.temporal).toBeDefined()
      expect(result.temporal!.year).toBe(2026)
      expect(result.temporal!.month).toBe(7)
      expect(result.temporal!.day).toBe(1)

      // This should add half a year directly, as minutes
      result = dt.add({ years: 0.5 })
      expect(result.temporal).toBeDefined()
      expect(result.temporal!.year).toBe(2025)
      expect(result.temporal!.month).toBe(12)
      expect(result.since(dt)).toBeCloseTo(0.5 * MINUTES_PER_YEAR)

      // Should add directly
      result = dt.add({ minutes: 1 })
      expect(result.temporal).toBeDefined()
      expect(result.temporal!.year).toBe(2025)
      expect(result.temporal!.month).toBe(7)
      expect(result.temporal!.minute).toBe(1)
    })

    it('should be able to subtract durations', () => {
      const dt = new DeepTime('2025-07-01T00:00:00+00:00[UTC]')
      let result = dt.subtract({ minutes: 1 })
      expect(result.temporal).toBeDefined()
      expect(result.temporal!.year).toBe(2025)
      expect(result.temporal!.month).toBe(6)
      expect(result.temporal!.day).toBe(30)
      expect(result.since(dt)).toBeCloseTo(-1)

      result = dt.subtract({ hours: 1 })
      expect(result.temporal).toBeDefined()
      expect(result.temporal!.year).toBe(2025)
      expect(result.temporal!.month).toBe(6)
      expect(result.temporal!.day).toBe(30)
      expect(result.since(dt)).toBeCloseTo(-60)

      result = dt.subtract({ days: 1 })
      expect(result.temporal).toBeDefined()
      expect(result.temporal!.year).toBe(2025)
      expect(result.temporal!.month).toBe(6)
      expect(result.temporal!.day).toBe(30)
      expect(result.since(dt)).toBeCloseTo(-MINUTES_PER_DAY)
    })

    it('should fail when trying to subtract fractional months/days/hours/minutes', () => {
      const baseTime = new DeepTime({ year: 2020 })

      // These should throw errors
      expect(() => {
        baseTime.subtract({ months: 1.5 })
      }).toThrow(/Duration property 'months' must be an integer/)

      // Note: minutes and seconds can be fractional
      const result = baseTime.subtract({
        hours: 12.1,
        minutes: 45.6,
        seconds: 1.234
      })
      expect(result).toBeDefined()
    })
  })

  describe('Comparison Methods', () => {
    it('should compare temporal precision dates', () => {
      const date1 = new DeepTime({ year: 2020 })
      const date2 = new DeepTime({ year: 2025 })

      expect(date1.compare(date2)).toBeLessThan(0)
      expect(date2.compare(date1)).toBeGreaterThan(0)
      expect(date1.compare(date1)).toBe(0)
    })

    it('should compare ancient dates', () => {
      const ancient1 = new DeepTime({ year: -1000000000 })
      const ancient2 = new DeepTime({ year: -500000000 })

      expect(ancient1.compare(ancient2)).toBeLessThan(0)
      expect(ancient2.compare(ancient1)).toBeGreaterThan(0)
    })

    it('should test equality for temporal dates', () => {
      const date1 = new DeepTime({ year: 2020 })
      const date2 = new DeepTime({ year: 2020 })
      const date3 = new DeepTime({ year: 2025 })

      expect(date1.equals(date2)).toBe(true)
      expect(date1.equals(date3)).toBe(false)
    })

    it('should test equality for year precision dates', () => {
      const ancient1 = new DeepTime({ year: -1000000000 })
      const ancient2 = new DeepTime({ year: -1000000000 })
      const ancient3 = new DeepTime({ year: -500000000 })

      expect(ancient1.equals(ancient2)).toBe(true)
      expect(ancient1.equals(ancient3)).toBe(false)
    })

    it('should handle small floating point differences in year precision', () => {
      const year1 = new DeepTime({ year: -1000000000.0001 })
      const year2 = new DeepTime({ year: -1000000000.0 })

      expect(year1.year + 1).toBe(year2.year)
    })
  })

  describe('Log-space Methods', () => {
    it('should be able to convert to log and back', () => {
      const now = new DeepTime('2025-01-01T00:00:00+00:00[UTC]')
      const past = new DeepTime('2020-01-01T00:00:00+00:00[UTC]')
      let logTime = past.toLog(now)
      expect(logTime).toBeCloseTo(14.7828)
      const t2 = DeepTime.fromLog(logTime, now)
      expect(t2).toBeCloseTo(past.minutesSince1970)
      logTime = now.toLog(past) // backwards, should give 0
      expect(logTime).toBeCloseTo(0)
    })
  })

  describe('Formatting Methods', () => {
    it('should format temporal dates with toString', () => {
      const date = new DeepTime({ year: 2023 })
      const str = date.toString()
      expect(str).toContain('2023-01-01')
      expect(str).toContain('UTC')
    })

    it('should format year precision dates with toString', () => {
      const ancient = new DeepTime({ year: -1000000000 })
      const str = ancient.toString()
      expect(str).toContain('1000.0M years BC')
    })

    it('should format large year precision dates', () => {
      const veryAncient = new DeepTime({ year: -13800000000 }) // Big Bang
      const str = veryAncient.toString()
      expect(str).toContain('13800.0M years BC')
    })

    it('should format smaller ancient dates', () => {
      const ancient = new DeepTime({ year: -50000 })
      const str = ancient.toString()
      // This is actually within Temporal range, so it formats as ISO string
      expect(str).toContain('-050000-01-01')
    })

    it('should format recent BC dates', () => {
      const recent = new DeepTime({ year: -500 })
      const str = recent.toString()
      // This is within Temporal range, so it formats as ISO string
      expect(str).toContain('-000500-01-01')
    })

    it('should format AD dates', () => {
      const ad = new DeepTime({ year: 1500 })
      const str = ad.toString()
      // This is within Temporal range, so it formats as ISO string
      expect(str).toContain('1500-01-01')
    })
    it('should format dates with fractional minutes properly', () => {
      let dt = new DeepTime({ yearsAgo: 1 / 52 })
      let str = dt.toString()
      expect(str).not.toContain('AD')
      expect(str).toContain('UTC')
      dt = new DeepTime({ minutesSinceEpoch: 29120365.600615386 })
      str = dt.toString()
      expect(str).not.toContain('AD')
      expect(str).toContain('UTC')
    })
  })

  describe('Relative Time Formatting', () => {
    it('should format recent times relatively', () => {
      const now = DeepTime.now()
      const recent = now.subtract({ minutes: 30 })
      const relStr = recent.toRelativeString(now)

      expect(relStr).toContain('minutes ago')
    })

    it('should format hours ago', () => {
      const now = DeepTime.now()
      const hoursAgo = now.subtract({ hours: 5 })
      const relStr = hoursAgo.toRelativeString(now)

      expect(relStr).toContain('hours ago')
    })

    it('should format days ago', () => {
      const now = DeepTime.now()
      const daysAgo = now.subtract({ days: 3 })
      const relStr = daysAgo.toRelativeString(now)

      expect(relStr).toContain('days ago')
    })

    it('should format years ago', () => {
      const hundredYearsAgo = new DeepTime({ yearsAgo: 100 })
      const relStr = hundredYearsAgo.toRelativeString()

      expect(relStr).toBe('100 years ago')
    })

    it('should format thousands of years ago', () => {
      const ancient = new DeepTime({ yearsAgo: 50000 })
      const relStr = ancient.toRelativeString()

      expect(relStr).toBe('50,000 years ago')
    })

    it('should format millions of years ago', () => {
      const veryAncient = new DeepTime({ yearsAgo: 65000000 })
      const relStr = veryAncient.toRelativeString()

      expect(relStr).toBe('65 million years ago')
    })

    it('should format billions of years ago', () => {
      const earthFormation = new DeepTime({
        year: GEOLOGICAL_EVENTS.EARTH_FORMATION
      })
      const relStr = earthFormation.toRelativeString()

      expect(relStr).toBe('4.5 billion years ago')
    })

    it('should handle now case', () => {
      const now = DeepTime.now()
      const almostNow = now.subtract({ seconds: 30 })
      const relStr = almostNow.toRelativeString(now)

      expect(relStr).toBe('now')
    })
  })

  describe('Locale Formatting', () => {
    it('should format temporal dates with locale', () => {
      const date = new DeepTime({ year: 2023 })
      const localeStr = date.toLocaleString('en-US')

      expect(typeof localeStr).toBe('string')
      expect(localeStr.length).toBeGreaterThan(0)
    })

    it('should format year precision dates with locale', () => {
      const ancient = new DeepTime({ year: -1000 })
      const localeStr = ancient.toLocaleString('en-US')

      // This is actually within Temporal range, so it formats as a date
      expect(typeof localeStr).toBe('string')
      expect(localeStr.length).toBeGreaterThan(0)
    })
  })

  describe('Conversion Methods', () => {
    it('should convert temporal dates to JavaScript Date', () => {
      const longTime = new DeepTime({ year: 2023 })
      const jsDate = longTime.toDate()

      expect(jsDate).toBeInstanceOf(Date)
      // Year should be 2023, allowing for timezone conversion
      expect([2022, 2023]).toContain(jsDate.getFullYear())
    })

    it('should throw when converting year precision to Date', () => {
      const ancient = new DeepTime({ year: -1000000000 })

      expect(() => ancient.toDate()).toThrow(
        'Cannot convert ancient DeepTime to Date'
      )
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle invalid string input', () => {
      expect(() => new DeepTime('invalid-date-string')).toThrow()
    })

    it('should handle null/undefined gracefully', () => {
      const current = new DeepTime(undefined)
      expect(current).toBeDefined()
    })

    it('should handle extreme year values', () => {
      const extremeAncient = new DeepTime({ year: -999999999999 })
      expect(extremeAncient.year).toBe(-999999999999)
    })

    it('should handle extreme future values', () => {
      const extremeFuture = new DeepTime({ year: 999999999999 })
      expect(extremeFuture.year).toBe(999999999999)
    })
  })

  describe('Geological Events Constants', () => {
    it('should create DeepTime from geological events', () => {
      const bigBang = new DeepTime({ year: GEOLOGICAL_EVENTS.BIG_BANG })
      expect(bigBang.year).toBe(-13800000000)

      const earthFormation = new DeepTime({
        year: GEOLOGICAL_EVENTS.EARTH_FORMATION
      })
      expect(earthFormation.year).toBe(-4540000000)

      const agriculture = new DeepTime({ year: GEOLOGICAL_EVENTS.AGRICULTURE })
      expect(agriculture.year).toBe(-10000)
    })

    it('should correctly order geological events', () => {
      const bigBang = new DeepTime({ year: GEOLOGICAL_EVENTS.BIG_BANG })
      const earthFormation = new DeepTime({
        year: GEOLOGICAL_EVENTS.EARTH_FORMATION
      })
      const firstLife = new DeepTime({ year: GEOLOGICAL_EVENTS.FIRST_LIFE })
      const agriculture = new DeepTime({ year: GEOLOGICAL_EVENTS.AGRICULTURE })

      expect(bigBang.compare(earthFormation)).toBeLessThan(0)
      expect(earthFormation.compare(firstLife)).toBeLessThan(0)
      expect(firstLife.compare(agriculture)).toBeLessThan(0)
    })
  })
})
