import { DeepTime } from '../deep-time'

export interface RawEvent {
  name: string
  categories?: string[]
  date: string // ISO date or "YYYYBCE" or "YYYYCE" or "YYYYAD" format - will be parsed by DeepTime
  significance: number // 1-10, where 10 is most significant
}

// Each event can have any number of categories.
// We try to keep the standard category list short, so it can be presented to users.
// Events may have categories beyond these -- they're ignored for now.
// Defined categories as of today:
// - music
// - painting
// - sculpture
// - architecture
// - geology
// - paleontology
// - astronomy
// - physics
// - math
// - inventions
// - philosophy
// - religion
// - politics
// - wars
// - nations
// - ideas
// - women
// - architecture
// - architecture

// These are presented to the user as combinations:
// - arts: all arts
// - natural history: geology, paleontology
// - sci/tech: astronomy, physics, math, inventions
// - philosophy/religion
// - human history: politics, war, nations
// - women: women
// - ideas: ???
// Questions:
// - others?

export interface Event {
  name: string
  date: DeepTime
  categories: string[]
  significance: number
}

/**
 * An event with its visible x,y coord
 */
export interface VisibleEvent {
  x: number
  y: number
  event: Event
}

/**
 * Process raw events into timeline-ready format using DeepTime
 */
export function processEvents(events: RawEvent[]): Event[] {
  return events
    .map((event) => {
      let date
      try {
        date = new DeepTime(event.date)
      } catch (error) {
        // Ignore the event
        console.warn(
          `Failed to parse date "${event.date}" for event "${event.name}":`,
          error
        )
        return null
      }
      return {
        name: event.name,
        date,
        categories: event.categories || [],
        significance: event.significance
      }
    })
    .filter((item) => item != null)
}

/**
 * Load base events from the local JSON file (always called)
 */
// Track last known events for change detection
let lastEventsJson: string = ''
let lastModified: string = ''

export async function loadEventsFromFile(): Promise<Event[]> {
  try {
    // Try different potential paths for the events file
    const possiblePaths = [
      '/src/data/events.json',
      '/data/events.json',
      './data/events.json',
      '../data/events.json'
    ]

    for (const path of possiblePaths) {
      try {
        // Add timestamp to bypass cache for change detection
        const response = await fetch(`${path}?t=${Date.now()}`)
        if (response.ok) {
          const text = await response.text()
          lastEventsJson = text // Store for change detection
          lastModified = response.headers.get('Last-Modified') || '' // Store timestamp
          const events: RawEvent[] = JSON.parse(text)
          console.log(`Successfully loaded events from ${path}`)
          return processEvents(events)
        }
      } catch {
        // Continue to next path
        continue
      }
    }

    throw new Error('Events file not found at any expected location')
  } catch (error) {
    console.warn('Failed to load base events from file:', error)
    return []
  }
}

/**
 * Check if the events file has changed using HEAD request (efficient)
 */
export async function checkEventsFileChanged(): Promise<{
  changed: boolean
  events?: Event[]
}> {
  try {
    const possiblePaths = [
      '/src/data/events.json',
      '/data/events.json',
      './data/events.json',
      '../data/events.json'
    ]

    for (const path of possiblePaths) {
      try {
        // First, do a lightweight HEAD request to check Last-Modified
        const headResponse = await fetch(`${path}?t=${Date.now()}`, {
          method: 'HEAD'
        })
        if (headResponse.ok) {
          const currentModified =
            headResponse.headers.get('Last-Modified') || ''

          // If we have a Last-Modified header and it hasn't changed, no need to download
          if (
            lastModified &&
            currentModified &&
            currentModified === lastModified
          ) {
            return { changed: false }
          }

          // File might have changed, download and check content
          const response = await fetch(`${path}?t=${Date.now()}`)
          if (response.ok) {
            const text = await response.text()

            // Check if content has actually changed
            if (text !== lastEventsJson) {
              console.log('Events file has changed, reloading...')
              lastEventsJson = text
              lastModified = response.headers.get('Last-Modified') || ''
              const events: RawEvent[] = JSON.parse(text)
              return {
                changed: true,
                events: processEvents(events)
              }
            } else {
              // Content same but timestamp different - update timestamp
              lastModified = response.headers.get('Last-Modified') || ''
              return { changed: false }
            }
          }
        }
      } catch {
        continue
      }
    }

    return { changed: false }
  } catch (error) {
    console.warn('Failed to check events file:', error)
    return { changed: false }
  }
}

/**
 * File watcher for events.json
 */
export class EventFileWatcher {
  private checkInterval: number
  private intervalId: number | null = null
  private onFileChange: (events: Event[]) => void

  constructor(
    onFileChange: (events: Event[]) => void,
    checkInterval: number // msec
  ) {
    this.onFileChange = onFileChange
    this.checkInterval = checkInterval
  }

  start() {
    if (this.intervalId) {
      this.stop()
    }

    this.intervalId = window.setInterval(async () => {
      const result = await checkEventsFileChanged()
      if (result.changed && result.events) {
        this.onFileChange(result.events)
      }
    }, this.checkInterval)

    console.log(`Started file watcher, checking every ${this.checkInterval}ms`)
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      console.log('Stopped file watcher')
    }
  }
}

/**
 * Load additional events from API
 */
export async function loadEventsFromAPI(
  apiUrl: string = 'https://timeline-events-api.garyo.workers.dev'
): Promise<Event[]> {
  try {
    console.log(`Loading additional events from ${apiUrl}...`)
    const response = await fetch(apiUrl)
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`)
    }
    const events: RawEvent[] = await response.json()
    console.log(
      `Successfully loaded ${events.length} additional events from API`
    )
    return processEvents(events)
  } catch (error) {
    console.warn('Failed to load additional events from API:', error)
    return [] // No new events
  }
}

/**
 * Load all events: base events from JSON file + additional events from API
 */
export async function loadAllEvents(
  apiUrl: string = 'https://timeline-events-api.garyo.workers.dev'
): Promise<{
  baseEvents: Event[]
  additionalEvents: Event[]
  allEvents: Event[]
}> {
  // Always load base events first
  const baseEvents = await loadEventsFromFile()

  // Then try to load additional events from API
  const additionalEvents = await loadEventsFromAPI(apiUrl)

  // Combine them
  const allEvents = [...baseEvents, ...additionalEvents]

  console.log(
    `Total events: ${baseEvents.length} base + ${additionalEvents.length} additional = ${allEvents.length}`
  )

  return { baseEvents, additionalEvents, allEvents }
}

/**
 * Update events periodically from API
 */
export class EventUpdater {
  private apiUrl: string
  private updateInterval: number
  private intervalId: number | null = null
  private onUpdate: (events: Event[]) => void

  constructor(
    apiUrl: string,
    onUpdate: (events: Event[]) => void,
    updateInterval: number = 60000 // 1 minute default
  ) {
    this.apiUrl = apiUrl
    this.onUpdate = onUpdate
    this.updateInterval = updateInterval
  }

  start() {
    if (this.intervalId) {
      this.stop()
    }

    // Initial load
    this.updateEvents()

    // Set up periodic updates
    this.intervalId = window.setInterval(() => {
      this.updateEvents()
    }, this.updateInterval)
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  private async updateEvents() {
    try {
      const additionalEvents = await loadEventsFromAPI(this.apiUrl)
      this.onUpdate(additionalEvents)
    } catch (error) {
      console.error('Failed to update additional events:', error)
    }
  }
}

/**
 * Data structure for storing & efficiently querying events within x ranges.
 * Maintains events sorted by x to enable O(log n) searching and range queries.
 * Stores VisibleEvents (events + xy coords)
 */
export class RangeQueryableEvents {
  private _events: VisibleEvent[] = []

  /**
   * Adds a single event while maintaining sorted order by x.
   * Time complexity: O(log n) for search + O(n) for insertion = O(n)
   *
   * @param event - The event to add
   */
  add(event: VisibleEvent): void {
    const insertIndex = this.findInsertionPoint(event.x)
    this._events.splice(insertIndex, 0, event)
  }

  /**
   * Adds multiple events at once. More efficient than calling add() repeatedly.
   * Time complexity: O(n log n) where n is total events after insertion
   *
   * @param events - Array of events to add
   */
  addAll(events: VisibleEvent[]): void {
    this._events.push(...events)
    this._events.sort((a, b) => a.x - b.x)
  }

  /**
   * Finds a specific event by searching for its x and then matching the exact event reference.
   * Time complexity: O(log n + k) where k is the number of events at the same x
   *
   * @param event - The event to find
   * @returns The index of the event if found, or -1 if not found
   */
  findIndex(event: VisibleEvent): number {
    // First, find the range of events at this x
    const startIndex = this.findLeftBound(event.x)
    const endIndex = this.findRightBound(event.x)

    // If no events at this x, return -1
    if (startIndex > endIndex) {
      return -1
    }

    // Search through events at this x for exact match
    for (let i = startIndex; i <= endIndex; i++) {
      if (this._events[i] === event) {
        return i
      }
    }

    return -1
  }

  /**
   * Finds all events within the specified x range [x0, x1] (inclusive).
   * Time complexity: O(log n + k) where k is the number of results
   *
   * @param x0 - Left bound of range (inclusive)
   * @param x1 - Right bound of range (inclusive)
   * @returns Array of events within the range
   */
  queryRange(x0: number, x1: number): VisibleEvent[] {
    if (x0 > x1) return []

    const startIndex = this.findLeftBound(x0)
    const endIndex = this.findRightBound(x1)

    return startIndex <= endIndex
      ? this._events.slice(startIndex, endIndex + 1)
      : []
  }

  /**
   * Finds all events within the specified x range [x0, x1] (inclusive).
   * Time complexity: O(log n + k) where k is the number of results.
   * This avoids allocation of the array
   *
   * @param x0 - Left bound of range (inclusive)
   * @param x1 - Right bound of range (inclusive)
   * @param targetArray - array to populate with events (will be cleared first)
   */
  queryRangeInto(x0: number, x1: number, targetArray: VisibleEvent[]): void {
    targetArray.length = 0 // clear first
    if (x0 > x1) return

    const startIndex = this.findLeftBound(x0)
    const endIndex = this.findRightBound(x1)

    // Populate the target array
    for (let i = startIndex; i <= endIndex; i++) {
      targetArray.push(this._events[i])
    }
  }

  /**
   * Counts events within the specified x range without materializing results.
   * Time complexity: O(log n)
   *
   * @param x0 - Left bound of range (inclusive)
   * @param x1 - Right bound of range (inclusive)
   * @returns Number of events in range
   */
  countInRange(x0: number, x1: number): number {
    if (x0 > x1) return 0

    const startIndex = this.findLeftBound(x0)
    const endIndex = this.findRightBound(x1)

    return Math.max(0, endIndex - startIndex + 1)
  }

  /**
   * Read-only accessor for iterating over all events in sorted order.
   * Returns the internal array directly (do not modify!).
   * Time complexity: O(1)
   *
   * @returns Read-only view of events array
   */
  get events(): readonly VisibleEvent[] {
    return this._events
  }

  /**
   * Removes all events from the data structure.
   * Time complexity: O(1)
   */
  clear(): void {
    this._events.length = 0
  }

  /**
   * Removes a specific event by reference.
   * Time complexity: O(n)
   *
   * @param event - The event reference to remove
   * @returns true if event was found and removed, false otherwise
   */
  remove(event: VisibleEvent): boolean {
    const index = this._events.indexOf(event)
    if (index === -1) return false

    this._events.splice(index, 1)
    return true
  }

  /**
   * Finds the insertion point for a value to maintain sorted order.
   * Uses binary search to find the leftmost position where x could be inserted.
   *
   * @param x - The x value to find insertion point for
   * @returns Index where x should be inserted
   */
  private findInsertionPoint(x: number): number {
    let left = 0
    let right = this._events.length

    while (left < right) {
      const mid = (left + right) >>> 1 // Bit shift for faster division
      if (this._events[mid].x < x) {
        left = mid + 1
      } else {
        right = mid
      }
    }

    return left
  }

  /**
   * Finds the leftmost index where events have x >= target.
   * This is the "lower bound" - the first position where target could be inserted
   * while maintaining sorted order.
   *
   * Example: [1, 3, 3, 5] with target=3 returns index 1 (first occurrence of 3)
   *
   * @param x - Target x coord
   * @returns Index of first event with x >= target, or events.length if none found
   */
  private findLeftBound(x: number): number {
    let left = 0
    let right = this._events.length

    while (left < right) {
      const mid = (left + right) >>> 1
      if (this._events[mid].x < x) {
        left = mid + 1
      } else {
        right = mid
      }
    }

    return left
  }

  /**
   * Finds the rightmost index where events have x <= target.
   * This is the "upper bound" - the last position where an event <= target exists.
   *
   * Example: [1, 3, 3, 5] with target=3 returns index 2 (last occurrence of 3)
   *
   * @param x - Target x coord
   * @returns Index of last event with x <= target, or -1 if none found
   */
  private findRightBound(x: number): number {
    let left = 0
    let right = this._events.length - 1

    while (left <= right) {
      const mid = (left + right) >>> 1
      if (this._events[mid].x <= x) {
        left = mid + 1
      } else {
        right = mid - 1
      }
    }

    return right
  }
}
