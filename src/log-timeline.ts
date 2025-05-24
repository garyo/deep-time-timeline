// Install with: npm install temporal-polyfill
// For bundlers, you may need to add to your import map or configure appropriately
import { Temporal } from 'temporal-polyfill'
import { DeepTime, MINUTES_PER_YEAR } from './deep-time.ts'
import type { DeepTimeSpec } from './deep-time.ts'

class LogTimeline {
  private leftmostTime!: DeepTime
  private rightmostTime!: DeepTime
  private refTime: DeepTime = new DeepTime() // = now
  private readonly width: number

  /**
   * LogTimeline constructor
   * @param width - width in pixels
   * @param leftmostTime - start time
   * @param rightmostTime - end time
   * Times can be DeepTime, Date, date-string (ISO or "1000BC"), Temporal, or other forms
   */
  constructor(
    width: number,
    leftmostTime: DeepTime | DeepTimeSpec,
    rightmostTime: DeepTime | DeepTimeSpec
  ) {
    // Input validation
    if (width <= 0) throw new Error('Width must be positive')

    this.width = width

    this.setEndpoints(leftmostTime, rightmostTime)
  }

  private calculateScalingFactor(): number {
    if (this.width <= 1) {
      return Infinity // Handle edge case explicitly
    }

    // Get the time difference between endpoints in minutes
    const totalMinutes = Math.abs(
      this.rightmostTime.minutesSince1970 - this.leftmostTime.minutesSince1970
    )
    if (totalMinutes <= 0) {
      throw new Error('Time span must be positive')
    }

    // For logarithmic scaling: each pixel represents n times the duration of the pixel to its right
    // The rightmost pixel represents 1 minute (our epsilon)
    // Each pixel to the left represents n times more
    // So: 1 * n^(width-1) = totalMinutes
    const result = Math.pow(totalMinutes, 1 / (this.width - 1))

    if (!Number.isFinite(result)) {
      throw new Error('Scaling factor calculation resulted in non-finite value')
    }

    return result
  }

  /**
   * Update time endpoints
   */
  public setEndpoints(
    leftmostTime: DeepTime | DeepTimeSpec,
    rightmostTime?: DeepTime | DeepTimeSpec
  ): void {
    const newLeftmost = new DeepTime(leftmostTime)
    const newRightmost = new DeepTime(rightmostTime)

    // Ensure leftmost is older than rightmost
    if (newLeftmost.compare(newRightmost) >= 0) {
      throw new Error(
        'Leftmost time must be older (smaller) than rightmost time'
      )
    }

    this.leftmostTime = newLeftmost
    this.rightmostTime = newRightmost
  }

  // Method to zoom around a specific time point
  // factor > 1 zooms in, factor < 1 zooms out
  // The given time will remain at the same pixel position after zooming
  public zoomAroundTime(factor: number, focalTime: DeepTime): void {
    if (factor <= 0) {
      throw new Error('Zoom factor must be positive')
    }

    // Get current log distances from center to left/right
    // Note: all logs are relative to the timeline's reference time (usually about now)
    // example:
    //  left log = 10, focal time log = 5, right time log = 1
    // left dist = 5, right dist = 4
    // after scaling: left dist = 2.5, right dist = 2
    // new left log = 5 + 2.5 = 7.5
    // new right log = 5 - 2 = 3
    const logDistLeft =
      this.leftmostTime.toLog(this.refTime) - focalTime.toLog(this.refTime)
    const logDistRight =
      focalTime.toLog(this.refTime) - this.rightmostTime.toLog(this.refTime)

    // Apply zoom: shrink distances by factor
    const newLogDistLeft = logDistLeft / factor
    const newLogDistRight = logDistRight / factor

    // Set new left/right times, keeping the time at focal point fixed
    const logFocalTime = focalTime.toLog(this.refTime)
    this.leftmostTime.minutesSince1970 = DeepTime.fromLog(
      logFocalTime + newLogDistLeft,
      this.refTime
    )
    this.rightmostTime.minutesSince1970 = DeepTime.fromLog(
      logFocalTime - newLogDistRight,
      this.refTime
    )
  }

  // Method to zoom around a specific pixel position
  public zoomAroundPixel(factor: number, pixelPosition: number): void {
    const focalTime = this.getTimeAtPixel(pixelPosition)
    this.zoomAroundTime(factor, focalTime)
  }

  // Method to shift the timeline window
  public shift(years: number): void {
    const newLeftmost = this.leftmostTime.add({ years })
    const newRightmost = this.rightmostTime.add({ years })
    this.setEndpoints(newLeftmost, newRightmost)
  }

  // Method to pan the timeline so that a specific time appears at a specific pixel position
  public panToPosition(targetTime: DeepTime, targetPixel: number): void {
    // We want targetTime to appear at targetPixel
    // This requires calculating what the left and right times should be

    const nowMinutes = this.refTime.minutesSince1970

    const targetMinutesFromNow = Math.max(
      nowMinutes - targetTime.minutesSince1970,
      1
    )

    // Get current log range per pixel
    const currentLeftMinutes = Math.max(
      nowMinutes - this.leftmostTime.minutesSince1970,
      1
    )
    const currentRightMinutes = Math.max(
      nowMinutes - this.rightmostTime.minutesSince1970,
      1
    )

    // Calculate log scale per pixel
    // Note: leftMinutes > rightMinutes (older times have more minutes from now)
    const logRange =
      Math.log(currentLeftMinutes) - Math.log(currentRightMinutes)
    const logPerPixel = logRange / this.width

    // Calculate what should be at left and right edges
    const logTarget = Math.log(targetMinutesFromNow)
    // Left edge is targetPixel pixels to the left of target
    // Since left = older = larger minutes, we ADD to go left
    const logLeft = logTarget + logPerPixel * targetPixel
    // Right edge is (width - targetPixel) pixels to the right of target
    // Since right = newer = smaller minutes, we SUBTRACT to go right
    const logRight = logTarget - logPerPixel * (this.width - targetPixel)

    const newLeftMinutes = Math.exp(logLeft)
    const newRightMinutes = Math.exp(logRight)

    // Convert back to DeepTime
    const newLeftTime = this.refTime.subtract({
      minutes: Math.round(newLeftMinutes)
    })
    const newRightTime = this.refTime.subtract({
      minutes: Math.round(newRightMinutes)
    })

    // Ensure the times are valid
    if (newLeftTime.compare(newRightTime) < 0) {
      this.setEndpoints(newLeftTime, newRightTime)
    }
  }

  // Method to shift the timeline window by pixels
  // Positive pixels shift right (forward in time), negative shifts left (backward in time)
  public shiftPixels(pixels: number): void {
    if (pixels === 0) return

    // Calculate what time should be at the left edge after shifting
    // If we shift right by +N pixels, then what's currently at pixel N should be at pixel 0
    const newLeftTime = this.getTimeAtPixel(pixels)

    // Calculate the time span to maintain in minutes
    const currentSpanMinutes =
      this.rightmostTime.minutesSince1970 - this.leftmostTime.minutesSince1970

    // Set new right time to maintain the same time span
    const newRightTime = newLeftTime.add({
      minutes: Math.round(currentSpanMinutes)
    })

    this.setEndpoints(newLeftTime, newRightTime)
  }

  public getPixelPosition(time: DeepTime | DeepTimeSpec): number {
    // Convert input to DeepTime
    const deepTime = new DeepTime(time)

    // If the time is outside our range, clamp it (only on the right, to avoid NaNs)
    if (deepTime.compare(this.rightmostTime) >= 0) {
      return this.width
    }

    // Calculate position using logarithmic scaling relative to "now"
    const nowMinutes = this.refTime.minutesSince1970

    // Get minutes from now for each point
    const minutesFromNow = Math.max(nowMinutes - deepTime.minutesSince1970, 1)
    const leftMinutesFromNow = Math.max(
      nowMinutes - this.leftmostTime.minutesSince1970,
      1
    )
    const rightMinutesFromNow = Math.max(
      nowMinutes - this.rightmostTime.minutesSince1970,
      1
    )

    // Calculate logarithmic position relative to now
    // Map log(minutesFromNow) to the range [log(leftMinutesFromNow), log(rightMinutesFromNow)]
    // Then map that to pixel range [0, width]
    const logTime = Math.log(minutesFromNow)
    const logLeft = Math.log(leftMinutesFromNow)
    const logRight = Math.log(rightMinutesFromNow)

    // Linear interpolation in log space
    const normalizedPosition = (logTime - logLeft) / (logRight - logLeft)
    const pixelPosition = normalizedPosition * this.width

    return Math.max(0, Math.min(this.width, pixelPosition))
  }

  public getTimeAtPixel(pixelPosition: number): DeepTime {
    // Note: don't clamp! We need out-of-range values to work for shifting.

    // Calculate time based on logarithmic scaling relative to "now"
    const nowMinutes = this.refTime.minutesSince1970

    // Get minutes from now for endpoints
    const leftMinutesFromNow = Math.max(
      nowMinutes - this.leftmostTime.minutesSince1970,
      1
    )
    const rightMinutesFromNow = Math.max(
      nowMinutes - this.rightmostTime.minutesSince1970,
      1
    )

    // Map pixel position to normalized position [0, 1]
    const normalizedPosition = pixelPosition / this.width

    // Map to log space
    const logLeft = Math.log(leftMinutesFromNow)
    const logRight = Math.log(rightMinutesFromNow)
    const logTime = logLeft + normalizedPosition * (logRight - logLeft)

    // Convert back to minutes from now
    const minutesFromNow = Math.exp(logTime)

    // Convert to DeepTime
    return this.refTime.subtract({ minutes: Math.round(minutesFromNow) })
  }

  /** Time span in years */
  public get timeSpan(): number {
    const timeDiff = this.rightmostTime.since(this.leftmostTime)
    return Math.abs(timeDiff / MINUTES_PER_YEAR)
  }

  public get pixelWidth(): number {
    return this.width
  }

  public get leftmost(): DeepTime {
    return this.leftmostTime
  }

  public get rightmost(): DeepTime {
    return this.rightmostTime
  }

  public get reftime(): DeepTime {
    // note different capitalization
    return this.refTime
  }

  public set reftime(newRefTime: DeepTime | DeepTimeSpec) {
    this.refTime = new DeepTime(newRefTime)
    // Note: This will affect all position calculations since they're relative to refTime
    // The caller should redraw the timeline after updating refTime
  }

  // Bounds checking and utility methods
  public isTimeInRange(
    time: DeepTime | Temporal.ZonedDateTime | Date
  ): boolean {
    const position = this.getPixelPosition(time)
    return position > 0 && position < this.width
  }

  public getTimelineRange(): { start: DeepTime; end: DeepTime } {
    return {
      start: this.leftmostTime,
      end: this.rightmostTime
    }
  }

  // Method to format times for display
  public formatTime(
    time: DeepTime,
    options?: Intl.DateTimeFormatOptions
  ): string {
    return time.toLocaleString(
      undefined,
      options || {
        dateStyle: 'medium',
        timeStyle: 'short'
      }
    )
  }

  // Method to get a human-readable description of the time span at a pixel
  public getPixelTimeSpan(pixelPosition: number): string {
    try {
      const time = this.getTimeAtPixel(pixelPosition)
      return time.toRelativeString(new DeepTime())
    } catch {
      return 'Invalid position'
    }
  }

  toString(): string {
    return `LogTimeline(${this.width}px, ${this.leftmostTime} - ${this.rightmostTime}`
  }

  // Generate ticks for timeline display
  public generateLogTicks(
    minPixelSpacing = 100
  ): { t: DeepTime; pos: number; label: string }[] {
    // Get log-space bounds
    // Note: log values increase to the left (more negative to the right, now=0)

    // Candidates: factors of 1, 2, 5 * 10^n in years or days
    // We'll build up tick values in years, months, days, hours as needed
    // For deep time: years, then switch to days for < 5 years ago

    // We'll scan log-space for nice tick values

    // Helper to find the next "nice" tick >= a value
    function nextNiceValue(val: number): number {
      // Finds next 1, 2, or 5 * 10^n >= val
      const exp = Math.floor(Math.log10(val))
      const bases = [1, 2, 5]
      for (let b of bases) {
        if (b * 10 ** exp > val) return b * 10 ** exp
      }
      return 10 ** (exp + 1)
    }

    function roundDownToMultiple(val: number, N: number) {
      let result = Math.floor(val / N) * N
      if (result == val) result -= N
      return result
    }

    function prevNiceYear(val: number): number {
      // every 10 years for recent years
      if (val >= 1900) return roundDownToMultiple(val, 10)
      if (val >= -10000) return roundDownToMultiple(val, 1000)
      if (val >= -40000) return roundDownToMultiple(val, 10000)
      const useNiceValues = true
      if (useNiceValues) {
        return -nextNiceValue(-val)
      } else {
        if (val >= -1e6) return roundDownToMultiple(val, 10000)
        if (val >= -1e8) return roundDownToMultiple(val, 100_000)
        if (val >= -1e9) return roundDownToMultiple(val, 1_000_000)
        if (val >= -1e10) return roundDownToMultiple(val, 1e7)
        if (val >= -1e11) return roundDownToMultiple(val, 1e8)
        if (val >= -1e12) return roundDownToMultiple(val, 1e9)
        return roundDownToMultiple(val, 1e12)
      }
    }

    // We'll create ticks in order from right (now) to left (past)
    let ticks: { t: DeepTime; pos: number; label: string }[] = []
    let lastTickPos = this.width + 100

    // minutes ago
    for (
      let val = 1, lastCheckPos = 1000;
      val < 3600 && lastCheckPos > 0;
      val = nextNiceValue(val)
    ) {
      let tickTime = this.refTime.subtract({ minutes: val })
      let tickPos = this.getPixelPosition(tickTime)
      lastCheckPos = tickPos
      if (
        tickPos < this.width &&
        tickPos > 0 &&
        tickPos < lastTickPos - minPixelSpacing
      ) {
        // it's a candidate
        ticks.push({ t: tickTime, pos: tickPos, label: `${val} minutes ago` })
        lastTickPos = tickPos
      }
    }

    // days ago
    for (
      let val = 1, lastCheckPos = 1;
      val < 365 && lastCheckPos > 0;
      val = nextNiceValue(val)
    ) {
      let tickTime = this.refTime.subtract({ days: val })
      let tickPos = this.getPixelPosition(tickTime)
      lastCheckPos = tickPos
      if (
        tickPos < this.width &&
        tickPos > 0 &&
        tickPos < lastTickPos - minPixelSpacing
      ) {
        ticks.push({ t: tickTime, pos: tickPos, label: `${val} days ago` })
        lastTickPos = tickPos
      }
    }

    // years
    for (
      let val = 2025, lastCheckPos = 1;
      val > -10000 && lastCheckPos > 0;
      val = prevNiceYear(val)
    ) {
      let tickTime = new DeepTime({ year: val })
      let tickPos = this.getPixelPosition(tickTime)
      lastCheckPos = tickPos
      if (
        tickPos < this.width &&
        tickPos > 0 &&
        tickPos < lastTickPos - minPixelSpacing
      ) {
        let label = `${tickTime.year} AD`
        if (tickTime.year < 0) label = `${-tickTime.year} BCE`
        ticks.push({ t: tickTime, pos: tickPos, label })
        lastTickPos = tickPos
      }
    }

    // deep past: "years ago"
    for (
      let val = -10000, lastCheckPos = 100000;
      val > -1e12 && lastCheckPos > 0;
      val = prevNiceYear(val)
    ) {
      let tickTime = this.refTime.subtract({ years: -val })
      let tickPos = this.getPixelPosition(tickTime)
      lastCheckPos = tickPos
      if (
        tickPos < this.width &&
        tickPos > 0 &&
        tickPos < lastTickPos - minPixelSpacing
      ) {
        const label = `${tickTime.toRelativeString()}`
        ticks.push({ t: tickTime, pos: tickPos, label })
        lastTickPos = tickPos
      }
    }

    return ticks
  }
}

export { LogTimeline, DeepTime }
