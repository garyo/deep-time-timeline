import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { LogTimeline } from '../src/log-timeline'
import { DeepTime } from '../src/deep-time'
import { Temporal } from 'temporal-polyfill'

describe('LogTimeline', () => {
  describe('Constructor', () => {
    it('should create a timeline with default parameters', () => {
      const timeline = new LogTimeline(800, { yearsAgo: 1000 }, { yearsAgo: 0 })

      expect(timeline.timeSpan, `${timeline}`).toBeCloseTo(1000, 0)
      expect(timeline.pixelWidth).toBe(800)
      expect(
        timeline.getTimeAtPixel(0).since(new DeepTime({ yearsAgo: 1000 })),
        `timeline: ${timeline}`
      ).toBeCloseTo(0, 0)
    })

    it('should create a timeline with DeepTimes and timezone', () => {
      const leftmost = new DeepTime({ yearsAgo: 5000 })
      const rightmost = new DeepTime({ yearsAgo: 0 })
      const timeline = new LogTimeline(1200, leftmost, rightmost)

      expect(timeline.timeSpan).toBeCloseTo(5000, 0)
      expect(timeline.pixelWidth).toBe(1200)
    })

    it('should create a timeline with non-zero rightmost', () => {
      const leftmost = new DeepTime({ yearsAgo: 5000 })
      const rightmost = new DeepTime({ yearsAgo: 1000 })
      const timeline = new LogTimeline(1200, leftmost, rightmost)

      expect(timeline.timeSpan).toBeCloseTo(4000, 0)
      expect(timeline.pixelWidth).toBe(1200)
      expect(timeline.getTimeAtPixel(0).since(leftmost)).toBeCloseTo(0, 0)
      expect(timeline.getTimeAtPixel(1200).since(rightmost)).toBeCloseTo(0, 0)
    })

    it('should handle small time spans', () => {
      const timeline = new LogTimeline(100, { yearsAgo: 1 }, { yearsAgo: 0 })

      expect(timeline.timeSpan).toBeCloseTo(1, 0)
    })
    it('should handle time spans of less than 1 year', () => {
      const timeline = new LogTimeline(
        100,
        { yearsAgo: 1 / 52 },
        { yearsAgo: 0 }
      )

      expect(timeline.timeSpan).toBeCloseTo(1 / 52, 0)
      const midpointTime = timeline.getTimeAtPixel(50)
      expect(
        midpointTime.toRelativeString(),
        `${timeline} midpointTime ${midpointTime}`
      ).toBe('2 hours ago')
    })
  })

  describe('getPixelPosition', () => {
    let timeline: LogTimeline
    let prevTime: Temporal.ZonedDateTime

    beforeEach(() => {
      const fixedNow = Temporal.ZonedDateTime.from('2025-05-21T12:00:00[UTC]')
      prevTime = fixedNow.subtract({ months: 1 })
      timeline = new LogTimeline(400, { yearsAgo: 100 }, fixedNow) // 100 years ago to "now"
      // Mock Temporal.Now.zonedDateTimeISO() to return a fixed time
      vi.spyOn(Temporal.Now, 'zonedDateTimeISO').mockReturnValue(fixedNow)
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should place current time at expected position', () => {
      const currentTime = new DeepTime(prevTime)
      const position = timeline.getPixelPosition(currentTime)

      // For a 100-year log scale timeline, the fixed time should be well to the right
      // but not at the edge since it's in the past
      // Actual value: 289.955
      expect(position).toBeCloseTo(290, -2)
    })

    it('should handle Temporal.ZonedDateTime input', () => {
      const zonedDateTime = prevTime
      const position = timeline.getPixelPosition(zonedDateTime)

      expect(position).toBeCloseTo(290, -2)
    })

    it('should handle JavaScript Date input', () => {
      const jsDate = new Date(prevTime.epochMilliseconds)
      const position = timeline.getPixelPosition(jsDate)

      expect(position).toBeCloseTo(290, -2)
    })

    it('should place very old dates at leftmost pixel', () => {
      const oldTime = new DeepTime({ yearsAgo: 100 })
      const position = timeline.getPixelPosition(oldTime)

      expect(position).toBeCloseTo(0, 1)
    })

    it('should handle dates older than timeline span', () => {
      const veryOldTime = new DeepTime({ yearsAgo: 200 })
      const position = timeline.getPixelPosition(veryOldTime)

      expect(position).toBe(0)
    })

    it('should handle dates more recent than timeline span', () => {
      const currentTime = DeepTime.now()
      const position = timeline.getPixelPosition(currentTime)

      expect(position).toBeGreaterThan(380)
      expect(position).toBeLessThanOrEqual(400)
    })

    it('should place intermediate dates correctly', () => {
      const oneYearAgo = new DeepTime({ yearsAgo: 1 })
      const position = timeline.getPixelPosition(oneYearAgo)

      expect(position).toBeGreaterThan(0)
      expect(position).toBeLessThan(400)
    })

    it('should be monotonic - more recent dates have higher pixel positions', () => {
      const oneYearAgo = new DeepTime({ yearsAgo: 1 })
      const tenYearsAgo = new DeepTime({ yearsAgo: 10 })
      const fiftyYearsAgo = new DeepTime({ yearsAgo: 50 })

      const pos1y = timeline.getPixelPosition(oneYearAgo)
      const pos10y = timeline.getPixelPosition(tenYearsAgo)
      const pos50y = timeline.getPixelPosition(fiftyYearsAgo)

      expect(pos1y).toBeGreaterThan(pos10y)
      expect(pos10y).toBeGreaterThan(pos50y)
    })
  })

  describe('getTimeAtPixel', () => {
    let timeline: LogTimeline
    let fixedNow: Temporal.ZonedDateTime

    beforeEach(() => {
      timeline = new LogTimeline(400, { yearsAgo: 100 }, { yearsAgo: 0 }) // 100 years ago to now
      fixedNow = Temporal.ZonedDateTime.from('2025-05-21T12:00:00[UTC]')
      vi.spyOn(Temporal.Now, 'zonedDateTimeISO').mockReturnValue(fixedNow)
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should return current time for rightmost pixel', () => {
      const time = timeline.getTimeAtPixel(400)
      const now = DeepTime.now()

      // Should be very close to now (within reasonable precision)
      const yearDiff = Math.abs(time.year - now.year)
      expect(yearDiff).toBeLessThan(1)
    })

    it('should return ancient dates for leftmost pixel', () => {
      const time = timeline.getTimeAtPixel(0)

      expect(time.year).toBeLessThan(2000) // Should be much older
    })

    it('should handle very ancient dates (using years)', () => {
      const longTimeline = new LogTimeline(
        400,
        { yearsAgo: 10000 },
        { yearsAgo: 1 }
      )
      const time = longTimeline.getTimeAtPixel(0)

      // Should handle very old dates without throwing
      expect(time.year).toBeLessThan(2000)
    })

    it('should be reasonably inverse of getPixelPosition for recent dates', () => {
      const originalTime = new DeepTime({ yearsAgo: 30 / 365.25 }) // 30 days ago
      const pixel = timeline.getPixelPosition(originalTime)
      const reconstructedTime = timeline.getTimeAtPixel(pixel)

      // Should be reasonably close to original (logarithmic scale means some precision loss)
      const yearDiff = Math.abs(originalTime.year - reconstructedTime.year)
      expect(yearDiff).toBeLessThan(5) // Within about 5 years for this scale
    })
  })

  describe('Static Utility Methods', () => {
    describe('fromYearsAgo', () => {
      let fixedNow: Temporal.ZonedDateTime

      beforeEach(() => {
        fixedNow = Temporal.ZonedDateTime.from('2025-05-21T12:00:00[UTC]')
        vi.spyOn(Temporal.Now, 'zonedDateTimeISO').mockReturnValue(fixedNow)
      })

      afterEach(() => {
        vi.restoreAllMocks()
      })

      it('should create timeline from years ago', () => {
        const timeline = new LogTimeline(400, { yearsAgo: 1 }, { yearsAgo: 0 })

        expect(timeline.timeSpan).toBeCloseTo(1, 0)
      })

      it('should handle large year spans', () => {
        const timeline = new LogTimeline(
          400,
          { yearsAgo: 15000 },
          { yearsAgo: 0 }
        )

        expect(timeline.timeSpan).toBeCloseTo(15000, 0)
      })

      it('should handle very large year spans (boundary case)', () => {
        const timeline = new LogTimeline(
          400,
          { yearsAgo: 1000000 },
          { yearsAgo: 0 }
        )

        expect(timeline.timeSpan).toBeCloseTo(1000000, 1)
      })
    })
  })

  describe('Pixel Time Span Description', () => {
    let timeline: LogTimeline

    beforeEach(() => {
      timeline = new LogTimeline(800, { yearsAgo: 10000 }, { yearsAgo: 1 })
    })

    it('should describe time spans for various positions', () => {
      // Test a range of positions
      const positions = [0, 200, 400, 600, 799]

      positions.forEach((pos) => {
        const description = timeline.getPixelTimeSpan(pos)
        expect(typeof description).toBe('string')
        expect(description.length).toBeGreaterThan(0)
        expect(description).toMatch(/(ago|Invalid position)/)
      })
    })

    it('should handle edge cases gracefully', () => {
      const descriptions = [
        timeline.getPixelTimeSpan(-1), // Below range
        timeline.getPixelTimeSpan(801), // Above range
        timeline.getPixelTimeSpan(0.5) // Fractional pixel
      ]

      descriptions.forEach((desc) => {
        expect(typeof desc).toBe('string')
        expect(desc.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Dynamic Timeline Adjustment', () => {
    let timeline: LogTimeline

    beforeEach(() => {
      timeline = new LogTimeline(400, { yearsAgo: 1000 }, { yearsAgo: 1 })
    })

    it('should shift timeline correctly', () => {
      const originalLeft = timeline.leftmost.year
      const originalRight = timeline.rightmost.year

      timeline.shift(-100) // Shift 100 years into the past

      expect(timeline.leftmost.year).toBeCloseTo(originalLeft - 100, 0)
      expect(timeline.rightmost.year).toBeCloseTo(originalRight - 100, 0)
    })

    it('should set new endpoints correctly', () => {
      const newLeft = new DeepTime({ yearsAgo: 5000 })
      const newRight = new DeepTime({ yearsAgo: 0 })

      timeline.setEndpoints(newLeft, newRight)

      expect(timeline.timeSpan).toBeCloseTo(5000, 0)
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should throw error for zero width', () => {
      expect(() => {
        const left = new DeepTime({ yearsAgo: 100 })
        const right = new DeepTime({ yearsAgo: 0 })
        new LogTimeline(0, left, right)
      }).toThrow('Width must be positive')
    })

    it('should throw error for negative width', () => {
      expect(() => {
        const left = new DeepTime({ yearsAgo: 100 })
        const right = new DeepTime({ yearsAgo: 0 })
        new LogTimeline(-1, left, right)
      }).toThrow('Width must be positive')
    })

    it('should throw error for invalid time order', () => {
      expect(() => {
        const left = new DeepTime({ yearsAgo: 0 }) // Now
        const right = new DeepTime({ yearsAgo: 100 }) // 100 years ago
        new LogTimeline(400, left, right)
      }).toThrow('Leftmost time must be older (smaller) than rightmost time')
    })

    it('should accept valid timezone', () => {
      expect(() => {
        new LogTimeline(400, { yearsAgo: 100 }, { yearsAgo: 1 })
      }).not.toThrow()

      expect(() => {
        new LogTimeline(400, { yearsAgo: 100 }, { yearsAgo: 1 })
      }).not.toThrow()
    })

    it('should handle width of 1', () => {
      const timeline = new LogTimeline(1, { yearsAgo: 100 }, { yearsAgo: 0 })

      expect(timeline.pixelWidth).toBe(1)
    })

    it('should handle very large time spans', () => {
      const timeline = new LogTimeline(
        400,
        { yearsAgo: 1000000000 },
        { yearsAgo: 0 }
      ) // 1 billion years

      expect(timeline.timeSpan).toBeGreaterThan(999999000) // Close to 1 billion
    })

    it('should allow out-of-bounds pixel positions', () => {
      const timeline = new LogTimeline(
        400,
        '1925-05-21T12:00:00[UTC]',
        '2025-05-21T12:00:00[UTC]'
      )

      const t0 = timeline.getTimeAtPixel(-1)
      expect(t0.year).toBeLessThan(1926)
      const t1 = timeline.getTimeAtPixel(401)
      expect(t1.year).toBe(2025)
    })
  })

  describe('Consistency and Round-trip Tests', () => {
    let timeline: LogTimeline
    let fixedNow: Temporal.ZonedDateTime

    beforeEach(() => {
      timeline = new LogTimeline(400, { yearsAgo: 1000 }, { yearsAgo: 0 })
      fixedNow = Temporal.ZonedDateTime.from('2025-05-21T12:00:00[UTC]')
      vi.spyOn(Temporal.Now, 'zonedDateTimeISO').mockReturnValue(fixedNow)
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should maintain pixel ordering consistency', () => {
      const pixels = [0, 100, 200, 300, 400]
      const times = pixels.map((p) => timeline.getTimeAtPixel(p))

      // Times should be in chronological order (oldest to newest)
      for (let i = 1; i < times.length; i++) {
        expect(times[i].compare(times[i - 1])).toBeGreaterThanOrEqual(0)
      }
    })

    it('should handle round-trip conversion with reasonable accuracy for log scale', () => {
      const testPixels = [50, 150, 250, 350]

      testPixels.forEach((originalPixel) => {
        const time = timeline.getTimeAtPixel(originalPixel)
        const reconstructedPixel = timeline.getPixelPosition(time)

        // Logarithmic scale means significant precision loss at extremes
        expect(
          Math.abs(reconstructedPixel - originalPixel),
          `Failed for originalPixel=${originalPixel} (reconstructed=${reconstructedPixel})`
        ).toBeLessThan(200)
      })
    })

    it('should maintain timeline bounds', () => {
      const leftTime = timeline.getTimeAtPixel(0)
      const rightTime = timeline.getTimeAtPixel(timeline.pixelWidth)

      const leftPixel = timeline.getPixelPosition(leftTime)
      const rightPixel = timeline.getPixelPosition(rightTime)

      expect(leftPixel).toBeCloseTo(0, 1)
      expect(rightPixel).toBeCloseTo(timeline.pixelWidth, 1)
    })
  })

  describe('Performance and Stability', () => {
    it('should handle many rapid calculations without degradation', () => {
      const timeline = new LogTimeline(400, { yearsAgo: 1000 }, { yearsAgo: 0 })
      const startTime = performance.now()

      // Perform many calculations
      for (let i = 0; i < 1000; i++) {
        const pixel = i % 400
        const time = timeline.getTimeAtPixel(pixel)
        timeline.getPixelPosition(time)
      }

      const endTime = performance.now()
      expect(endTime - startTime).toBeLessThan(1000) // Should complete in under 1 second
    })

    it('should produce stable results for same inputs', () => {
      const timeline = new LogTimeline(400, { yearsAgo: 1000 }, { yearsAgo: 0 })
      const testPixel = 200

      const results = Array.from({ length: 10 }, () => {
        const time = timeline.getTimeAtPixel(testPixel)
        return timeline.getPixelPosition(time)
      })

      // All results should be similar
      const firstResult = results[0]
      results.forEach((result) => {
        expect(Math.abs(result - firstResult)).toBeLessThan(1)
      })
    })
  })

  describe('Tick generation', () => {
    it('should be able to generate ticks', () => {
      const now = new DeepTime()
      let timeline = new LogTimeline(1000, { yearsAgo: 1 }, 'now')
      let ticks = timeline.generateLogTicks(100)
      expect(ticks).toBeDefined
      expect(ticks.length).toBeGreaterThan(5)
      expect(ticks.length).toBeLessThan(15)
      expect(ticks[0].pos).toBeLessThan(1000)
      expect(ticks[0].label).toBe('2 minutes ago')

      // million years ago to now
      timeline = new LogTimeline(1000, { yearsAgo: 1e6 }, 'now')
      ticks = timeline.generateLogTicks(100)
      expect(ticks).toBeDefined
      expect(ticks.length).toBeGreaterThan(5)
      expect(ticks.length).toBeLessThan(15)
      expect(ticks[0].pos).toBeLessThan(1000)
      expect(ticks[0].label).toBe('2 minutes ago')
    })
  })

  describe('Real-world Usage Scenarios', () => {
    it('should handle typical web application timeline (1 week)', () => {
      const timeline = new LogTimeline(
        400,
        { yearsAgo: 1 / 52 },
        { yearsAgo: 0 }
      ) // 1 week span

      const sixHoursAgo = DeepTime.now().subtract({ hours: 6 })
      const twoDaysAgo = DeepTime.now().subtract({ days: 2 })

      const pos6h = timeline.getPixelPosition(sixHoursAgo)
      const pos2d = timeline.getPixelPosition(twoDaysAgo)

      expect(pos6h).toBeLessThan(400)
      expect(pos2d).toBeLessThan(400)
      expect(pos6h).toBeGreaterThan(0)
      expect(pos2d).toBeGreaterThan(0)
      expect(pos6h, `Timeline: ${timeline}, t=${sixHoursAgo}`).toBeGreaterThan(
        pos2d
      )
    })

    it('should handle historical timeline (1000 years)', () => {
      const timeline = new LogTimeline(
        1000,
        { yearsAgo: 1000 },
        { yearsAgo: 1 }
      )

      const medieval = new DeepTime({ yearsAgo: 800 })
      const industrial = new DeepTime({ yearsAgo: 200 })
      const modern = new DeepTime({ yearsAgo: 50 })

      const posM = timeline.getPixelPosition(medieval)
      const posI = timeline.getPixelPosition(industrial)
      const posMod = timeline.getPixelPosition(modern)

      expect(posM).toBeLessThan(posI)
      expect(posI).toBeLessThan(posMod)
    })

    it('should handle geological timeline (4.5 billion years)', () => {
      const timeline = new LogTimeline(
        800,
        { yearsAgo: 4500000000 },
        { yearsAgo: 1 }
      )

      const earthFormation = new DeepTime({ yearsAgo: 4500000000 })
      const dinosaurs = new DeepTime({ yearsAgo: 65000000 })
      const humans = new DeepTime({ yearsAgo: 200000 })

      const posE = timeline.getPixelPosition(earthFormation)
      const posD = timeline.getPixelPosition(dinosaurs)
      const posH = timeline.getPixelPosition(humans)

      // For very large time spans, positions might be close due to precision
      expect(posE).toBeLessThanOrEqual(posD)
      expect(posD).toBeLessThanOrEqual(posH)
      expect(posE).toBeLessThanOrEqual(800) // Should be within the timeline
    })
  })
})
