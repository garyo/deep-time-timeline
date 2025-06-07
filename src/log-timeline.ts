import { Temporal } from 'temporal-polyfill'
import { batch } from 'solid-js'
import { DeepTime, MINUTES_PER_YEAR } from './deep-time.ts'
import type { DeepTimeSpec } from './deep-time.ts'
import type { SetStoreFunction } from 'solid-js/store'
import type { TimelineState } from './stores/global-timeline.ts'

class LogTimeline {
  constructor(
    private getState: () => TimelineState,
    private setState: SetStoreFunction<TimelineState>
  ) {}

  /**
   * Initialize timeline with given parameters
   */
  public initialize(
    width: number,
    leftmostTime: DeepTime | DeepTimeSpec,
    rightmostTime: DeepTime | DeepTimeSpec,
    refTime?: DeepTime | DeepTimeSpec
  ): void {
    // Input validation
    if (width <= 0) throw new Error('Width must be positive')

    const newLeftmost = new DeepTime(leftmostTime)
    const newRightmost = new DeepTime(rightmostTime)
    const newRefTime =
      refTime instanceof DeepTime ? refTime : new DeepTime(refTime)

    // Validate endpoints
    if (newLeftmost.compare(newRightmost) >= 0) {
      throw new Error(
        'Leftmost time must be older (smaller) than rightmost time'
      )
    }

    // Set all initial state
    batch(() => {
      this.setState('leftmostTime', newLeftmost)
      this.setState('rightmostTime', newRightmost)
      this.setState('refTime', newRefTime)
      this.setState('width', width)
    })
  }

  /**
   * Update time endpoints
   */
  public setEndpoints(
    leftmostTime: DeepTime | DeepTimeSpec,
    rightmostTime?: DeepTime | DeepTimeSpec
  ): void {
    const newLeftmost = new DeepTime(leftmostTime)
    let newRightmost = new DeepTime(rightmostTime)

    // Ensure leftmost is older than rightmost
    if (newLeftmost.compare(newRightmost) >= 0) {
      throw new Error(
        'Leftmost time must be older (smaller) than rightmost time'
      )
    }
    // Ensure rightmost is in range (<= refTime)
    const state = this.getState()
    if (newRightmost.compare(state.refTime) > 0) newRightmost = state.refTime

    // Batch both updates together
    batch(() => {
      this.setState('leftmostTime', newLeftmost)
      this.setState('rightmostTime', newRightmost)
    })
  }

  // Method to zoom around a specific time point
  // factor > 1 zooms in, factor < 1 zooms out
  // The given time will remain at the same pixel position after zooming
  public zoomAroundTime(factor: number, focalTime: DeepTime): void {
    if (factor <= 0) {
      throw new Error('Zoom factor must be positive')
    }

    const state = this.getState()

    // Get current log distances from center to left/right
    const logDistLeft =
      state.leftmostTime.toLog(state.refTime) - focalTime.toLog(state.refTime)
    const logDistRight =
      focalTime.toLog(state.refTime) - state.rightmostTime.toLog(state.refTime)

    // Apply zoom: shrink distances by factor
    const newLogDistLeft = logDistLeft / factor
    const newLogDistRight = logDistRight / factor

    // Set new left/right times, keeping the time at focal point fixed
    const logFocalTime = focalTime.toLog(state.refTime)
    const newLeftmost = new DeepTime()
    newLeftmost.minutesSince1970 = DeepTime.fromLog(
      logFocalTime + newLogDistLeft,
      state.refTime
    )
    const newRightmost = new DeepTime()
    newRightmost.minutesSince1970 = DeepTime.fromLog(
      logFocalTime - newLogDistRight,
      state.refTime
    )

    batch(() => {
      this.setState('leftmostTime', newLeftmost)
      this.setState('rightmostTime', newRightmost)
    })
  }

  // Method to zoom around a specific pixel position
  public zoomAroundPixel(factor: number, pixelPosition: number): void {
    const focalTime = this.getTimeAtPixel(pixelPosition)
    this.zoomAroundTime(factor, focalTime)
  }

  // Pan the timeline so that a specific time appears at a specific pixel position
  public panToPosition(targetTime: DeepTime, targetPixel: number): void {
    const state = this.getState()
    const nowMinutes = state.refTime.minutesSince1970

    const targetMinutesFromNow = Math.max(
      nowMinutes - targetTime.minutesSince1970,
      1
    )

    // Get current log range per pixel
    const currentLeftMinutes = Math.max(
      nowMinutes - state.leftmostTime.minutesSince1970,
      1
    )
    const currentRightMinutes = Math.max(
      nowMinutes - state.rightmostTime.minutesSince1970,
      1
    )

    // Calculate log scale per pixel
    const logRange =
      Math.log(currentLeftMinutes) - Math.log(currentRightMinutes)
    const logPerPixel = logRange / state.width

    // Calculate what should be at left and right edges
    const logTarget = Math.log(targetMinutesFromNow)
    const logLeft = logTarget + logPerPixel * targetPixel
    const logRight = logTarget - logPerPixel * (state.width - targetPixel)

    const newLeftMinutes = Math.exp(logLeft)
    const newRightMinutes = Math.exp(logRight)

    // Convert back to DeepTime
    const newLeftTime = state.refTime.subtract({
      minutes: Math.round(newLeftMinutes)
    })
    const newRightTime = state.refTime.subtract({
      minutes: Math.round(newRightMinutes)
    })

    // Ensure the times are valid
    if (newLeftTime.compare(newRightTime) < 0) {
      batch(() => {
        this.setState('leftmostTime', newLeftTime)
        this.setState('rightmostTime', newRightTime)
      })
    }
  }

  // Method to shift the timeline window by N pixels
  // Positive pixels shift right (forward in time), negative shifts left (backward in time)
  public shiftPixels(pixels: number): void {
    if (pixels === 0) return

    const x = this.pixelWidth / 2
    const targetTime = this.getTimeAtPixel(x - pixels)
    this.panToPosition(targetTime, x)
  }

  public getPixelPosition(time: DeepTime | DeepTimeSpec): number {
    // Convert input to DeepTime
    const deepTime = time instanceof DeepTime ? time : new DeepTime(time)
    const state = this.getState()

    // If the time is outside our range, clamp it (only on the right, to avoid NaNs)
    if (deepTime.compare(state.rightmostTime) >= 0) {
      return state.width
    }

    // Calculate position using logarithmic scaling relative to "now"
    const nowMinutes = state.refTime.minutesSince1970

    // Get minutes from now for each point
    const minutesFromNow = Math.max(nowMinutes - deepTime.minutesSince1970, 1)
    const leftMinutesFromNow = Math.max(
      nowMinutes - state.leftmostTime.minutesSince1970,
      1
    )
    const rightMinutesFromNow = Math.max(
      nowMinutes - state.rightmostTime.minutesSince1970,
      1
    )

    // Calculate logarithmic position relative to now
    const logTime = Math.log(minutesFromNow)
    const logLeft = Math.log(leftMinutesFromNow)
    const logRight = Math.log(rightMinutesFromNow)

    // Linear interpolation in log space
    const normalizedPosition = (logTime - logLeft) / (logRight - logLeft)
    const pixelPosition = normalizedPosition * state.width

    return Math.max(0, Math.min(state.width, pixelPosition))
  }

  public getTimeAtPixel(pixelPosition: number): DeepTime {
    // Calculate time based on logarithmic scaling relative to "now"
    const state = this.getState()
    const nowMinutes = state.refTime.minutesSince1970

    // Get minutes from now for endpoints
    const leftMinutesFromNow = Math.max(
      nowMinutes - state.leftmostTime.minutesSince1970,
      1
    )
    const rightMinutesFromNow = Math.max(
      nowMinutes - state.rightmostTime.minutesSince1970,
      1
    )

    // Map pixel position to normalized position [0, 1]
    const normalizedPosition = pixelPosition / state.width

    // Map to log space
    const logLeft = Math.log(leftMinutesFromNow)
    const logRight = Math.log(rightMinutesFromNow)
    const logTime = logLeft + normalizedPosition * (logRight - logLeft)

    // Convert back to minutes from now
    const minutesFromNow = Math.exp(logTime)

    // Convert to DeepTime
    return state.refTime.subtract({ minutes: Math.round(minutesFromNow) })
  }

  /** Time span in years */
  public get timeSpan(): number {
    const state = this.getState()
    const timeDiff = state.rightmostTime.since(state.leftmostTime)
    return Math.abs(timeDiff / MINUTES_PER_YEAR)
  }

  public get pixelWidth(): number {
    return this.getState().width
  }

  /**
   * Update the timeline width without changing the time range
   * @param newWidth - new width in pixels
   */
  public set pixelWidth(newWidth: number) {
    if (newWidth <= 0) throw new Error('Width must be positive')
    this.setState('width', newWidth)
  }

  public get leftmost(): DeepTime {
    return this.getState().leftmostTime
  }

  public get rightmost(): DeepTime {
    return this.getState().rightmostTime
  }

  public get reftime(): DeepTime {
    return this.getState().refTime
  }

  public set reftime(newRefTime: DeepTime | DeepTimeSpec) {
    this.setState('refTime', new DeepTime(newRefTime))
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
    const state = this.getState()

    // If rightmost is already at now (within ε), do nothing
    if (now.equals(state.rightmostTime)) {
      return false
    }

    // Calculate the current time span in minutes
    const timeSpanMinutes = state.rightmostTime.since(state.leftmostTime)

    // Batch both updates together
    batch(() => {
      this.setState('rightmostTime', now)
      this.setState('leftmostTime', now.subtract({ minutes: timeSpanMinutes }))
    })

    return true
  }

  // Bounds checking and utility methods
  public isTimeInRange(
    time: DeepTime | Temporal.ZonedDateTime | Date
  ): boolean {
    const position = this.getPixelPosition(time)
    return position > 0 && position < this.getState().width
  }

  public getTimelineRange(): { start: DeepTime; end: DeepTime } {
    const state = this.getState()
    return {
      start: state.leftmostTime,
      end: state.rightmostTime
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
    const state = this.getState()
    return `LogTimeline(${state.width}px, ${state.leftmostTime} - ${state.rightmostTime})`
  }

  // Generate ticks for timeline display
  // Note: log values increase to the left (more negative to the right, now=0)
  public generateLogTicks(
    minPixelSpacing = 100
  ): { t: DeepTime; pos: number; label: string }[] {
    const state = this.getState()

    // Helper to find the next "nice" tick >= a value
    // Candidates: factors of 1, 2, 5 * 10^n in years or days
    // We'll build up tick values in years, months, days, hours as needed
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
    let lastTickPos = state.width + 100

    // minutes ago
    for (
      let val = 1, lastCheckPos = 1000;
      val < 3600 && lastCheckPos > 0;
      val = nextNiceValue(val)
    ) {
      let tickTime = state.refTime.subtract({ minutes: val })
      let tickPos = this.getPixelPosition(tickTime)
      lastCheckPos = tickPos
      if (
        tickPos < state.width &&
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
      let tickTime = state.refTime.subtract({ days: val })
      let tickPos = this.getPixelPosition(tickTime)
      lastCheckPos = tickPos
      if (
        tickPos < state.width &&
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
        tickPos < state.width &&
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
      let tickTime = state.refTime.subtract({ years: -val })
      let tickPos = this.getPixelPosition(tickTime)
      lastCheckPos = tickPos
      if (
        tickPos < state.width &&
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
