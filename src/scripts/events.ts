import { DeepTime } from '../deep-time'

export interface TimelineEvent {
  name: string
  date: string // ISO date or "YYYYBC" or "YYYYAD" format - will be parsed by DeepTime
  significance: number // 1-10, where 10 is most significant
}

export interface ProcessedEvent {
  name: string
  date: DeepTime
  significance: number
}

/**
 * Process raw events into timeline-ready format using DeepTime
 */
export function processEvents(events: TimelineEvent[]): ProcessedEvent[] {
  return events.map((event) => {
    try {
      return {
        name: event.name,
        date: new DeepTime(event.date),
        significance: event.significance
      }
    } catch (error) {
      console.warn(
        `Failed to parse date "${event.date}" for event "${event.name}":`,
        error
      )
      // Use a fallback date (current time) for unparseable dates
      return {
        name: event.name,
        date: new DeepTime(),
        significance: event.significance
      }
    }
  })
}

/**
 * Load base events from the local JSON file (always called)
 */
export async function loadEventsFromFile(): Promise<ProcessedEvent[]> {
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
        const response = await fetch(path)
        if (response.ok) {
          const events: TimelineEvent[] = await response.json()
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
    return getFallbackEvents()
  }
}

/**
 * Load additional events from API
 */
export async function loadEventsFromAPI(
  apiUrl: string = 'https://example.com/api/significant-events'
): Promise<ProcessedEvent[]> {
  try {
    console.log(`Loading additional events from ${apiUrl}...`)
    const response = await fetch(apiUrl)
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`)
    }
    const events: TimelineEvent[] = await response.json()
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
  apiUrl: string = 'https://example.com/api/significant-events'
): Promise<{
  baseEvents: ProcessedEvent[]
  additionalEvents: ProcessedEvent[]
  allEvents: ProcessedEvent[]
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
 * Fallback events in case both file and API fail
 */
function getFallbackEvents(): ProcessedEvent[] {
  return [
    { name: 'Internet', date: new DeepTime('1984'), significance: 8 },
    {
      name: 'Industrial Revolution',
      date: new DeepTime('1775'),
      significance: 9
    },
    { name: 'Writing', date: new DeepTime('3200BC'), significance: 10 },
    { name: 'First cities', date: new DeepTime('3500BC'), significance: 8 },
    { name: 'Agriculture', date: new DeepTime('8000BC'), significance: 10 },
    { name: 'Human species', date: new DeepTime('300000BC'), significance: 10 },
    {
      name: 'Dinosaur extinction',
      date: new DeepTime('66000000BC'),
      significance: 9
    },
    {
      name: 'First life',
      date: new DeepTime('3800000000BC'),
      significance: 10
    },
    {
      name: 'Earth formation',
      date: new DeepTime('4540000000BC'),
      significance: 10
    },
    { name: 'Big Bang', date: new DeepTime('13800000000BC'), significance: 10 }
  ]
}

/**
 * Update events periodically from API
 */
export class EventUpdater {
  private apiUrl: string
  private updateInterval: number
  private intervalId: number | null = null
  private onUpdate: (events: ProcessedEvent[]) => void

  constructor(
    apiUrl: string,
    onUpdate: (events: ProcessedEvent[]) => void,
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
