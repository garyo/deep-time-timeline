// Install with: npm install temporal-polyfill
// For bundlers, you may need to add to your import map or configure appropriately
import { Temporal } from 'temporal-polyfill'
import { createStore } from 'solid-js/store'
import { DeepTime, MINUTES_PER_YEAR } from './deep-time.ts'
import type { DeepTimeSpec } from './deep-time.ts'

class LogTimeline {
  private store
  private setStore
  private _updateScheduled = false
  private _updateCallback?: () => void

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
    rightmostTime: DeepTime | DeepTimeSpec,
    refTime?: DeepTime | DeepTimeSpec
  ) {
    // Input validation
    if (width <= 0) throw new Error('Width must be positive')

    // Create reactive store
    const [store, setStore] = createStore({
      leftmostTime: new DeepTime(leftmostTime),
      rightmostTime: new DeepTime(rightmostTime),
      refTime: refTime instanceof DeepTime ? refTime : new DeepTime(refTime),
      width: width
    })

    this.store = store
    this.setStore = setStore

    // Validate endpoints
    if (this.store.leftmostTime.compare(this.store.rightmostTime) >= 0) {
      throw new Error(
        'Leftmost time must be older (smaller) than rightmost time'
      )
    }
  }

  /**
   * Set a callback to be called when timeline updates are batched
   * This allows external reactive systems to be notified of changes
   */
  public setUpdateCallback(callback: () => void) {
    this._updateCallback = callback
  }

  /**
   * Schedule a batched update - all changes within a single tick get batched
   */
  private scheduleUpdate() {
    if (!this._updateScheduled) {
      this._updateScheduled = true
      queueMicrotask(() => {
        // Trigger external reactive updates
        this._updateCallback?.()
        this._updateScheduled = false
      })
    }
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

    // Batch both updates together
    this.setStore('leftmostTime', newLeftmost)
    this.setStore('rightmostTime', newRightmost)
    this.scheduleUpdate()
  }

  // Method to zoom around a specific time point
  // factor > 1 zooms in, factor < 1 zooms out
  // The given time will remain at the same pixel position after zooming
  public zoomAroundTime(factor: number, focalTime: DeepTime): void {
    if (factor <= 0) {
      throw new Error('Zoom factor must be positive')
    }

    // Get current log distances from center to left/right
    const logDistLeft =
      this.store.leftmostTime.toLog(this.store.refTime) -
      focalTime.toLog(this.store.refTime)
    const logDistRight =
      focalTime.toLog(this.store.refTime) -
      this.store.rightmostTime.toLog(this.store.refTime)

    // Apply zoom: shrink distances by factor
    const newLogDistLeft = logDistLeft / factor
    const newLogDistRight = logDistRight / factor

    // Set new left/right times, keeping the time at focal point fixed
    const logFocalTime = focalTime.toLog(this.store.refTime)
    const newLeftmost = new DeepTime()
    newLeftmost.minutesSince1970 = DeepTime.fromLog(
      logFocalTime + newLogDistLeft,
      this.store.refTime
    )
    const newRightmost = new DeepTime()
    newRightmost.minutesSince1970 = DeepTime.fromLog(
      logFocalTime - newLogDistRight,
      this.store.refTime
    )

    // Batch both updates together
    this.setStore('leftmostTime', newLeftmost)
    this.setStore('rightmostTime', newRightmost)
    this.scheduleUpdate()
  }

  // Method to zoom around a specific pixel position
  public zoomAroundPixel(factor: number, pixelPosition: number): void {
    const focalTime = this.getTimeAtPixel(pixelPosition)
    this.zoomAroundTime(factor, focalTime)
  }

  // Method to shift the timeline window
  public shift(years: number): void {
    const newLeftmost = this.store.leftmostTime.add({ years })
    const newRightmost = this.store.rightmostTime.add({ years })
    this.setEndpoints(newLeftmost, newRightmost)
  }

  // Method to pan the timeline so that a specific time appears at a specific pixel position
  public panToPosition(targetTime: DeepTime, targetPixel: number): void {
    const nowMinutes = this.store.refTime.minutesSince1970

    const targetMinutesFromNow = Math.max(
      nowMinutes - targetTime.minutesSince1970,
      1
    )

    // Get current log range per pixel
    const currentLeftMinutes = Math.max(
      nowMinutes - this.store.leftmostTime.minutesSince1970,
      1
    )
    const currentRightMinutes = Math.max(
      nowMinutes - this.store.rightmostTime.minutesSince1970,
      1
    )

    // Calculate log scale per pixel
    const logRange =
      Math.log(currentLeftMinutes) - Math.log(currentRightMinutes)
    const logPerPixel = logRange / this.store.width

    // Calculate what should be at left and right edges
    const logTarget = Math.log(targetMinutesFromNow)
    const logLeft = logTarget + logPerPixel * targetPixel
    const logRight = logTarget - logPerPixel * (this.store.width - targetPixel)

    const newLeftMinutes = Math.exp(logLeft)
    const newRightMinutes = Math.exp(logRight)

    // Convert back to DeepTime
    const newLeftTime = this.store.refTime.subtract({
      minutes: Math.round(newLeftMinutes)
    })
    const newRightTime = this.store.refTime.subtract({
      minutes: Math.round(newRightMinutes)
    })

    // Ensure the times are valid
    if (newLeftTime.compare(newRightTime) < 0) {
      // Batch both updates together
      this.setStore('leftmostTime', newLeftTime)
      this.setStore('rightmostTime', newRightTime)
      this.scheduleUpdate()
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
      this.store.rightmostTime.minutesSince1970 -
      this.store.leftmostTime.minutesSince1970

    // Set new right time to maintain the same time span
    const newRightTime = newLeftTime.add({
      minutes: Math.round(currentSpanMinutes)
    })

    this.setEndpoints(newLeftTime, newRightTime)
  }

  public getPixelPosition(time: DeepTime | DeepTimeSpec): number {
    // Convert input to DeepTime
    const deepTime = time instanceof DeepTime ? time : new DeepTime(time)

    // If the time is outside our range, clamp it (only on the right, to avoid NaNs)
    if (deepTime.compare(this.store.rightmostTime) >= 0) {
      return this.store.width
    }

    // Calculate position using logarithmic scaling relative to "now"
    const nowMinutes = this.store.refTime.minutesSince1970

    // Get minutes from now for each point
    const minutesFromNow = Math.max(nowMinutes - deepTime.minutesSince1970, 1)
    const leftMinutesFromNow = Math.max(
      nowMinutes - this.store.leftmostTime.minutesSince1970,
      1
    )
    const rightMinutesFromNow = Math.max(
      nowMinutes - this.store.rightmostTime.minutesSince1970,
      1
    )

    // Calculate logarithmic position relative to now
    const logTime = Math.log(minutesFromNow)
    const logLeft = Math.log(leftMinutesFromNow)
    const logRight = Math.log(rightMinutesFromNow)

    // Linear interpolation in log space
    const normalizedPosition = (logTime - logLeft) / (logRight - logLeft)
    const pixelPosition = normalizedPosition * this.store.width

    return Math.max(0, Math.min(this.store.width, pixelPosition))
  }

  public getTimeAtPixel(pixelPosition: number): DeepTime {
    // Calculate time based on logarithmic scaling relative to "now"
    const nowMinutes = this.store.refTime.minutesSince1970

    // Get minutes from now for endpoints
    const leftMinutesFromNow = Math.max(
      nowMinutes - this.store.leftmostTime.minutesSince1970,
      1
    )
    const rightMinutesFromNow = Math.max(
      nowMinutes - this.store.rightmostTime.minutesSince1970,
      1
    )

    // Map pixel position to normalized position [0, 1]
    const normalizedPosition = pixelPosition / this.store.width

    // Map to log space
    const logLeft = Math.log(leftMinutesFromNow)
    const logRight = Math.log(rightMinutesFromNow)
    const logTime = logLeft + normalizedPosition * (logRight - logLeft)

    // Convert back to minutes from now
    const minutesFromNow = Math.exp(logTime)

    // Convert to DeepTime
    return this.store.refTime.subtract({ minutes: Math.round(minutesFromNow) })
  }

  /** Time span in years */
  public get timeSpan(): number {
    const timeDiff = this.store.rightmostTime.since(this.store.leftmostTime)
    return Math.abs(timeDiff / MINUTES_PER_YEAR)
  }

  public get pixelWidth(): number {
    return this.store.width
  }

  /**
   * Update the timeline width without changing the time range
   * @param newWidth - new width in pixels
   */
  public set pixelWidth(newWidth: number) {
    if (newWidth <= 0) throw new Error('Width must be positive')
    this.setStore('width', newWidth)
    this.scheduleUpdate()
  }

  public get leftmost(): DeepTime {
    return this.store.leftmostTime
  }

  public get rightmost(): DeepTime {
    return this.store.rightmostTime
  }

  public get reftime(): DeepTime {
    return this.store.refTime
  }

  public set reftime(newRefTime: DeepTime | DeepTimeSpec) {
    this.setStore('refTime', new DeepTime(newRefTime))
    this.scheduleUpdate()
    // Note: This will affect all position calculations since they're relative to refTime
    // The caller should redraw the timeline after updating refTime
  }

  /**
   * Reset the rightmost time to the current time (now)
   * Maintains the same time span by adjusting the leftmost time accordingly
   * @returns true if the timeline was changed, false otherwise
   */
  public resetRightmostToNow(): boolean {
    const now = new DeepTime()

    // If rightmost is already at now (within ε), do nothing
    if (now.equals(this.store.rightmostTime)) {
      return false
    }

    // Calculate the current time span in minutes
    const timeSpanMinutes = this.store.rightmostTime.since(
      this.store.leftmostTime
    )

    // Batch both updates together
    this.setStore('rightmostTime', now)
    this.setStore('leftmostTime', now.subtract({ minutes: timeSpanMinutes }))
    this.scheduleUpdate()

    return true
  }

  // Bounds checking and utility methods
  public isTimeInRange(
    time: DeepTime | Temporal.ZonedDateTime | Date
  ): boolean {
    const position = this.getPixelPosition(time)
    return position > 0 && position < this.store.width
  }

  public getTimelineRange(): { start: DeepTime; end: DeepTime } {
    return {
      start: this.store.leftmostTime,
      end: this.store.rightmostTime
    }
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
    return `LogTimeline(${this.store.width}px, ${this.store.leftmostTime} - ${this.store.rightmostTime}`
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
      if (val > 1900) return roundDownToMultiple(val, 10)
      if (val > 1000) return roundDownToMultiple(val, 100)
      if (val > -1000) return roundDownToMultiple(val, 500)
      if (val > -10000) return roundDownToMultiple(val, 1000)
      if (val > -40000) return roundDownToMultiple(val, 10000)
      const useNiceValues = true
      if (useNiceValues) {
        return -nextNiceValue(-val)
      } else {
        if (val > -1e6) return roundDownToMultiple(val, 10000)
        if (val > -1e8) return roundDownToMultiple(val, 100_000)
        if (val > -1e9) return roundDownToMultiple(val, 1_000_000)
        if (val > -1e10) return roundDownToMultiple(val, 1e7)
        if (val > -1e11) return roundDownToMultiple(val, 1e8)
        if (val > -1e12) return roundDownToMultiple(val, 1e9)
        return roundDownToMultiple(val, 1e12)
      }
    }

    // We'll create ticks in order from right (now) to left (past)
    let ticks: { t: DeepTime; pos: number; label: string }[] = []
    let lastTickPos = this.store.width + 100

    // minutes ago
    for (
      let val = 1, lastCheckPos = 1000;
      val < 3600 && lastCheckPos > 0;
      val = nextNiceValue(val)
    ) {
      let tickTime = this.store.refTime.subtract({ minutes: val })
      let tickPos = this.getPixelPosition(tickTime)
      lastCheckPos = tickPos
      if (
        tickPos < this.store.width &&
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
      let tickTime = this.store.refTime.subtract({ days: val })
      let tickPos = this.getPixelPosition(tickTime)
      lastCheckPos = tickPos
      if (
        tickPos < this.store.width &&
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
        tickPos < this.store.width &&
        tickPos > 0 &&
        tickPos < lastTickPos - minPixelSpacing
      ) {
        let label = `${tickTime.year} CE`
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
      let tickTime = this.store.refTime.subtract({ years: -val })
      let tickPos = this.getPixelPosition(tickTime)
      lastCheckPos = tickPos
      if (
        tickPos < this.store.width &&
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
